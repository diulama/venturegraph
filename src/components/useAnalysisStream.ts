"use client";

import { useCallback, useRef, useState } from "react";
import {
  AgentEvent,
  AnalysisInput,
  Evidence,
  GraphData,
  GraphLink,
  GraphNode,
  Interpretation,
  Reflection,
} from "@/lib/agent/types";

export interface ActivityEntry {
  id: number;
  kind: "phase" | "tool" | "info";
  text: string;
  done?: boolean;
}

export interface StreamState {
  status: "idle" | "running" | "complete" | "error";
  phase: string | null;
  activity: ActivityEntry[];
  graph: GraphData;
  evidence: Evidence[];
  summary: string;
  interpretation: Interpretation | null;
  reflection: Reflection | null;
  savedId: string | null;
  error: string | null;
}

const initial: StreamState = {
  status: "idle",
  phase: null,
  activity: [],
  graph: { nodes: [], links: [] },
  evidence: [],
  summary: "",
  interpretation: null,
  reflection: null,
  savedId: null,
  error: null,
};

let activityId = 0;

function mergeGraph(prev: GraphData, fragment: GraphData): GraphData {
  const nodes = new Map<string, GraphNode>(prev.nodes.map((n) => [n.id, n]));
  for (const n of fragment.nodes) {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
    else if (n.tagline && !nodes.get(n.id)!.tagline) {
      nodes.set(n.id, { ...nodes.get(n.id)!, tagline: n.tagline });
    }
  }
  const linkKey = (l: GraphLink) => `${l.source}|${l.type}|${l.target}`;
  const reverseKey = (l: GraphLink) => `${l.target}|${l.type}|${l.source}`;
  const links = new Map<string, GraphLink>(
    prev.links.map((l) => [linkKey(l), l]),
  );
  for (const l of fragment.links) {
    if (!links.has(linkKey(l)) && !links.has(reverseKey(l)))
      links.set(linkKey(l), l);
  }
  return { nodes: [...nodes.values()], links: [...links.values()] };
}

export function useAnalysisStream(getToken: () => string | null) {
  const [state, setState] = useState<StreamState>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initial);
  }, []);

  const start = useCallback(
    async (input: AnalysisInput) => {
      const token = getToken();
      if (!token) {
        setState((s) => ({ ...s, status: "error", error: "Not signed in" }));
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...initial, status: "running" });

      const apply = (event: AgentEvent) =>
        setState((s) => {
          switch (event.type) {
            case "phase":
              return {
                ...s,
                phase: event.phase,
                activity: [
                  ...s.activity.map((a) => ({ ...a, done: true })),
                  {
                    id: ++activityId,
                    kind: "phase" as const,
                    text: event.detail,
                  },
                ],
              };
            case "tool_start":
              return {
                ...s,
                activity: [
                  ...s.activity,
                  {
                    id: ++activityId,
                    kind: "tool" as const,
                    text: event.label,
                  },
                ],
              };
            case "tool_result":
              return {
                ...s,
                graph: mergeGraph(s.graph, event.graph),
                evidence: [...s.evidence, ...event.evidence],
                activity: s.activity.map((a, i) =>
                  i === s.activity.length - 1 ? { ...a, done: true } : a,
                ),
              };
            case "interpretation":
              return { ...s, interpretation: event.data };
            case "reflection":
              return {
                ...s,
                reflection: event.data,
                activity: event.data.rationale
                  ? [
                      ...s.activity,
                      {
                        id: ++activityId,
                        kind: "info" as const,
                        text: `Agent: ${event.data.rationale}`,
                        done: true,
                      },
                    ]
                  : s.activity,
              };
            case "summary_delta":
              return { ...s, summary: s.summary + event.text };
            case "complete":
              return {
                ...s,
                status: "complete",
                phase: null,
                graph: event.graph,
                evidence: event.evidence,
                summary: event.summary,
                activity: s.activity.map((a) => ({ ...a, done: true })),
              };
            case "saved":
              return { ...s, savedId: event.id };
            case "error":
              return s.status === "error"
                ? s
                : { ...s, status: "error", error: event.message };
            default:
              return s;
          }
        });

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(
            res.status === 401
              ? "Session expired — sign in again"
              : `Request failed (${res.status})`,
          );
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              apply(JSON.parse(line) as AgentEvent);
            } catch {
              /* skip malformed line */
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((s) =>
          s.status === "error"
            ? s
            : {
                ...s,
                status: "error",
                error: err instanceof Error ? err.message : "Stream failed",
              },
        );
      }
    },
    [getToken],
  );

  return { state, start, reset };
}
