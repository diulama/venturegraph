"use client";

import { useMemo, useState } from "react";
import { Evidence, GraphNode } from "@/lib/agent/types";

const CATEGORY_ORDER = [
  "Anchors",
  "Market landscape",
  "Competitors",
  "Adjacent markets",
  "Investors",
  "Technology signals",
  "Customer segments",
  "Partnerships",
];

export function EvidencePanel({
  evidence,
  focusNode,
}: {
  evidence: Evidence[];
  focusNode: GraphNode | null;
}) {
  const [openCypher, setOpenCypher] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!focusNode) return evidence;
    return evidence.filter(
      (e) => e.triple.from === focusNode.name || e.triple.to === focusNode.name,
    );
  }, [evidence, focusNode]);

  const groups = useMemo(() => {
    const map = new Map<string, Evidence[]>();
    for (const e of filtered) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }
    return [...map.entries()].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
    );
  }, [filtered]);

  if (!evidence.length) {
    return (
      <p className="px-4 py-6 text-center text-xs text-ink-3">
        Discovered relationships will appear here as the agent traverses the
        graph.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {focusNode && (
        <p className="rounded-lg border border-edge bg-surface-2 px-3 py-2 text-[11px] text-ink-2">
          Filtered to <strong className="text-ink">{focusNode.name}</strong> —
          click the background of the graph to clear.
        </p>
      )}
      {groups.map(([category, items]) => (
        <section key={category}>
          <h3 className="mb-1.5 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-widest text-ink-3">
            {category}
            <span className="font-mono text-[10px] text-ink-3">
              {items.length}
            </span>
          </h3>
          <ul className="space-y-1">
            {items.map((e) => (
              <li
                key={e.id}
                className="rise-in rounded-lg border border-edge bg-surface-1"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenCypher(openCypher === e.id ? null : e.id)
                  }
                  className="block w-full px-2.5 py-1.5 text-left"
                >
                  <span className="text-xs leading-snug text-ink-2">
                    {e.statement}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-ink-3">
                    {e.triple.from} —{e.triple.rel}→ {e.triple.to}
                  </span>
                </button>
                {openCypher === e.id && (
                  <pre className="overflow-x-auto border-t border-edge bg-surface-0 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-3">
                    {e.cypher}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
