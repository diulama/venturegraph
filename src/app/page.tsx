"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/components/AuthProvider";
import { LABEL_COLORS } from "@/lib/agent/types";

const rels = [
  "COMPETES_WITH",
  "INVESTED_BY",
  "USES_TECH",
  "SERVES",
  "PARTNERS_WITH",
  "IN_MARKET",
];

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="max-w-2xl text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          {Object.values(LABEL_COLORS).map((c) => (
            <span
              key={c}
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: c }}
            />
          ))}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Venture<span className="text-accent">Graph</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-2">
          Reason over the startup ecosystem —{" "}
          <span className="text-ink">don&apos;t just search it.</span>
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-3">
          Describe your idea and an AI agent traverses a Neo4j knowledge graph
          of companies, investors, technologies, markets, and customer segments
          — surfacing competitors, warm investor paths, and partnership white
          space through relationship reasoning.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          {rels.map((r) => (
            <span
              key={r}
              className="rounded-full border border-edge bg-surface-1 px-2.5 py-1 font-mono text-[10px] tracking-wide text-ink-3"
            >
              {r}
            </span>
          ))}
        </div>
      </div>
      <AuthForm />
      <p className="text-xs text-ink-3">
        Butterbase auth &amp; persistence · Neo4j relationship graph ·
        RocketRide Cloud reasoning
      </p>
    </main>
  );
}
