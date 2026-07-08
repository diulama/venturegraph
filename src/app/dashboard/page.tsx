"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisWorkspace } from "@/components/AnalysisWorkspace";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { useAnalysisStream } from "@/components/useAnalysisStream";
import { AnalysisRow, butterbase } from "@/lib/butterbase";
import { AnalysisInput } from "@/lib/agent/types";

export default function Dashboard() {
  const { user, loading, accessToken } = useAuth();
  const router = useRouter();
  const { state, start, reset } = useAnalysisStream(accessToken);
  const [input, setInput] = useState<AnalysisInput | null>(null);
  const [history, setHistory] = useState<AnalysisRow[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || state.status === "running") return;
    butterbase
      .from<AnalysisRow>("analyses")
      .select("id,idea,target_customer,differentiator,created_at,status")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setHistory(data ?? []));
  }, [user, state.status]);

  // Permalink once persisted, without tearing down the live workspace
  useEffect(() => {
    if (state.savedId) {
      window.history.replaceState(null, "", `/analysis/${state.savedId}`);
    }
  }, [state.savedId]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-ink-3">
        Loading…
      </main>
    );
  }

  const showWorkspace = input && state.status !== "idle";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-5 px-5 py-5">
        {showWorkspace ? (
          <>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  reset();
                  setInput(null);
                  window.history.replaceState(null, "", "/dashboard");
                }}
                className="text-xs text-ink-3 transition hover:text-ink-2"
              >
                ← New analysis
              </button>
              {state.savedId && (
                <span className="text-xs text-ink-3">
                  Saved ✓ —{" "}
                  <Link
                    href={`/analysis/${state.savedId}`}
                    className="text-accent hover:underline"
                  >
                    permalink
                  </Link>
                </span>
              )}
            </div>
            <AnalysisWorkspace
              idea={input.idea}
              targetCustomer={input.targetCustomer}
              differentiator={input.differentiator}
              graph={state.graph}
              evidence={state.evidence}
              summary={state.summary}
              running={state.status === "running"}
              activity={state.activity}
              error={state.error}
            />
          </>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-8 py-6">
            <AnalysisForm
              disabled={false}
              onSubmit={(i) => {
                setInput(i);
                start(i);
              }}
            />
            {history.length > 0 && (
              <section>
                <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                  Past analyses
                </h2>
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={`/analysis/${h.id}`}
                        className="block rounded-xl border border-edge bg-surface-1 px-4 py-3 transition hover:border-accent-soft hover:bg-surface-2"
                      >
                        <p className="truncate text-sm text-ink">{h.idea}</p>
                        <p className="mt-0.5 text-xs text-ink-3">
                          {h.target_customer} ·{" "}
                          {new Date(h.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
