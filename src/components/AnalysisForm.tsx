"use client";

import { useState } from "react";
import { AnalysisInput } from "@/lib/agent/types";

const EXAMPLE: AnalysisInput = {
  idea: "An AI-powered code review copilot that understands your entire codebase as a graph and flags architectural regressions before merge",
  targetCustomer: "Enterprise engineering teams",
  differentiator:
    "Graph-based whole-codebase reasoning instead of diff-only review",
};

export function AnalysisForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (input: AnalysisInput) => void;
  disabled?: boolean;
}) {
  const [idea, setIdea] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [differentiator, setDifferentiator] = useState("");

  const valid =
    idea.trim().length >= 10 &&
    targetCustomer.trim().length >= 3 &&
    differentiator.trim().length >= 3;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ idea, targetCustomer, differentiator });
      }}
      className="space-y-4 rounded-2xl border border-edge bg-surface-1 p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Analyze a startup idea
        </h2>
        <button
          type="button"
          onClick={() => {
            setIdea(EXAMPLE.idea);
            setTargetCustomer(EXAMPLE.targetCustomer);
            setDifferentiator(EXAMPLE.differentiator);
          }}
          className="text-xs text-accent hover:underline"
        >
          Try an example
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-3">Startup idea</span>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          placeholder="What are you building? One or two sentences."
          className="w-full resize-none rounded-lg border border-edge bg-surface-0 px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-3">Target customer</span>
          <input
            value={targetCustomer}
            onChange={(e) => setTargetCustomer(e.target.value)}
            placeholder="Who buys it?"
            className="w-full rounded-lg border border-edge bg-surface-0 px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-3">Differentiator</span>
          <input
            value={differentiator}
            onChange={(e) => setDifferentiator(e.target.value)}
            placeholder="Why you win"
            className="w-full rounded-lg border border-edge bg-surface-0 px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!valid || disabled}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
      >
        {disabled ? "Agent is working…" : "Run graph analysis"}
      </button>
    </form>
  );
}
