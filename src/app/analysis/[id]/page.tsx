"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisWorkspace } from "@/components/AnalysisWorkspace";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { AnalysisRow, butterbase } from "@/lib/butterbase";
import { Evidence, GraphData } from "@/lib/agent/types";

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [row, setRow] = useState<AnalysisRow | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    "loading",
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    butterbase
      .from<AnalysisRow>("analyses")
      .select("*")
      .eq("id", id)
      .limit(1)
      .then(({ data }) => {
        const found = data?.[0] ?? null;
        setRow(found);
        setState(found ? "ready" : "missing");
      });
  }, [user, id]);

  if (loading || !user || state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-ink-3">
        Loading analysis…
      </main>
    );
  }

  if (state === "missing" || !row) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-ink-3">
          Analysis not found (or it belongs to another account).
          <Link href="/dashboard" className="text-accent hover:underline">
            Back to dashboard
          </Link>
        </main>
      </div>
    );
  }

  const graph = (row.graph as GraphData) ?? { nodes: [], links: [] };
  // Evidence is stored object-wrapped ({ items }) — the data API rejects top-level jsonb arrays.
  const evidence = (row.evidence as { items?: Evidence[] } | null)?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-5 py-5">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xs text-ink-3 transition hover:text-ink-2"
          >
            ← Dashboard
          </Link>
          <span className="text-xs text-ink-3">
            {new Date(row.created_at).toLocaleString()}
          </span>
        </div>
        <AnalysisWorkspace
          idea={row.idea}
          targetCustomer={row.target_customer}
          differentiator={row.differentiator}
          graph={graph}
          evidence={evidence}
          summary={row.summary ?? ""}
          running={false}
        />
      </main>
    </div>
  );
}
