import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const API = process.env.BUTTERBASE_API_URL!;
const APP = process.env.BUTTERBASE_APP_ID!;

async function main() {
  const email = `e2e-${Date.now()}@venturegraph.test`;
  const password = "E2eDemo!2026";

  console.log("1. Signing up", email);
  const signup = await fetch(`${API}/auth/${APP}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: "E2E Bot" }),
  });
  if (!signup.ok)
    throw new Error(`signup ${signup.status}: ${await signup.text()}`);

  console.log("2. Logging in");
  const login = await fetch(`${API}/auth/${APP}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok)
    throw new Error(`login ${login.status}: ${await login.text()}`);
  const { access_token } = (await login.json()) as { access_token: string };

  console.log("3. Streaming /api/analyze");
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      idea: "A fintech platform that gives startup CFOs AI-driven runway forecasting connected to their banking and spend data",
      targetCustomer: "Finance teams at venture-backed startups",
      differentiator:
        "Live graph of a company's financial relationships instead of static spreadsheets",
    }),
  });
  if (!res.ok || !res.body)
    throw new Error(`analyze ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const counts: Record<string, number> = {};
  let savedId: string | null = null;
  let finalNodes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line) as {
        type: string;
        id?: string;
        graph?: { nodes: unknown[] };
      };
      counts[ev.type] = (counts[ev.type] ?? 0) + 1;
      if (ev.type === "saved") savedId = ev.id!;
      if (ev.type === "complete") finalNodes = ev.graph?.nodes.length ?? 0;
    }
  }
  console.log("   event counts:", counts);
  console.log(`   final graph nodes: ${finalNodes}, savedId: ${savedId}`);
  if (!counts.complete) throw new Error("no complete event");
  if (!savedId) throw new Error("analysis was not persisted");

  console.log("4. Reading analysis back (RLS-scoped)");
  const rowRes = await fetch(`${API}/v1/${APP}/analyses?id=eq.${savedId}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const rows = (await rowRes.json()) as { id: string; summary: string }[];
  if (!rows.length) throw new Error("row not readable by owner");
  console.log(`   row found, summary length ${rows[0].summary?.length}`);

  console.log("5. RLS negative check (second user must see nothing)");
  const email2 = `e2e2-${Date.now()}@venturegraph.test`;
  await fetch(`${API}/auth/${APP}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password }),
  });
  const login2 = await fetch(`${API}/auth/${APP}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password }),
  });
  const { access_token: token2 } = (await login2.json()) as {
    access_token: string;
  };
  const leakRes = await fetch(`${API}/v1/${APP}/analyses?id=eq.${savedId}`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const leaked = (await leakRes.json()) as unknown[];
  if (Array.isArray(leaked) && leaked.length > 0)
    throw new Error("RLS LEAK: other user can read the row!");
  console.log("   RLS holds — other user sees 0 rows");

  console.log("\n✅ E2E PASS");
}

main().catch((e) => {
  console.error("\n❌ E2E FAIL:", e.message);
  process.exit(1);
});
