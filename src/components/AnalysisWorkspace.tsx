"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Evidence, GraphData, GraphNode } from "@/lib/agent/types";
import { EvidencePanel } from "./EvidencePanel";
import { GraphLegend, GraphView } from "./GraphView";
import { ActivityEntry } from "./useAnalysisStream";

interface Props {
  idea: string;
  targetCustomer: string;
  differentiator: string;
  graph: GraphData;
  evidence: Evidence[];
  summary: string;
  running: boolean;
  activity?: ActivityEntry[];
  error?: string | null;
}

export function AnalysisWorkspace({
  idea,
  targetCustomer,
  differentiator,
  graph,
  evidence,
  summary,
  running,
  activity = [],
  error,
}: Props) {
  const [focusNode, setFocusNode] = useState<GraphNode | null>(null);
  const current =
    activity.findLast?.((a) => !a.done) ?? activity[activity.length - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Input chips + live ticker */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className="max-w-md truncate rounded-full border border-edge bg-surface-1 px-3 py-1 text-ink-2"
          title={idea}
        >
          💡 {idea}
        </span>
        <span className="rounded-full border border-edge bg-surface-1 px-3 py-1 text-ink-2">
          🎯 {targetCustomer}
        </span>
        <span
          className="max-w-xs truncate rounded-full border border-edge bg-surface-1 px-3 py-1 text-ink-2"
          title={differentiator}
        >
          ⚡ {differentiator}
        </span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-ink-3">
          {running && current ? (
            <>
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
              {current.text}
            </>
          ) : error ? (
            <span className="text-danger">✖ {error}</span>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-cat-investor" />
              {graph.nodes.length} nodes · {graph.links.length} relationships ·{" "}
              {evidence.length} evidence entries
            </>
          )}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:h-[calc(100dvh_-_160px)] lg:flex-none lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        {/* Summary */}
        <section className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-edge bg-surface-1">
          <header className="border-b border-edge px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
            AI analysis
          </header>
          <div className="summary-md min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {summary ? (
              <ReactMarkdown>{summary}</ReactMarkdown>
            ) : running ? (
              <AgentActivityFeed activity={activity} />
            ) : (
              <p className="text-xs text-ink-3">No summary yet.</p>
            )}
          </div>
        </section>

        {/* Graph */}
        <section className="flex min-h-[380px] flex-col overflow-hidden rounded-2xl border border-edge bg-surface-0">
          <header className="flex items-center justify-between border-b border-edge bg-surface-1 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-3">
              Ecosystem graph
            </span>
            <GraphLegend />
          </header>
          <div className="min-h-0 flex-1">
            <GraphView graph={graph} live={running} onSelect={setFocusNode} />
          </div>
        </section>

        {/* Evidence */}
        <section className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-edge bg-surface-1">
          <header className="border-b border-edge px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
            Evidence — {evidence.length} relationships
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EvidencePanel evidence={evidence} focusNode={focusNode} />
          </div>
        </section>
      </div>
    </div>
  );
}

function AgentActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  return (
    <ol className="space-y-1.5">
      {activity.map((a) => (
        <li
          key={a.id}
          className={`rise-in flex items-start gap-2 text-xs ${
            a.kind === "phase"
              ? "mt-2 font-medium text-ink first:mt-0"
              : a.kind === "info"
                ? "italic text-ink-2"
                : "text-ink-3"
          }`}
        >
          <span className="mt-0.5 w-3 shrink-0 text-center">
            {a.done ? (
              "✓"
            ) : (
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </span>
          {a.text}
        </li>
      ))}
    </ol>
  );
}
