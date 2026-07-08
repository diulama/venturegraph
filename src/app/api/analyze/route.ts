import { NextRequest } from "next/server";
import { z } from "zod";
import { runAnalysis } from "@/lib/agent/orchestrator";
import { AgentEvent } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  idea: z.string().min(10).max(1000),
  targetCustomer: z.string().min(3).max(500),
  differentiator: z.string().min(3).max(500),
});

const APP_ID = process.env.BUTTERBASE_APP_ID!;
const API_URL = process.env.BUTTERBASE_API_URL!;

async function validateUser(token: string): Promise<{ id: string } | null> {
  const res = await fetch(`${API_URL}/auth/${APP_ID}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string };
}

async function persistAnalysis(
  token: string,
  input: z.infer<typeof bodySchema>,
  done: Extract<AgentEvent, { type: "complete" }>,
): Promise<string | null> {
  const res = await fetch(`${API_URL}/v1/${APP_ID}/analyses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      idea: input.idea,
      target_customer: input.targetCustomer,
      differentiator: input.differentiator,
      summary: done.summary,
      graph: done.graph,
      // Data API rejects top-level JSON arrays in jsonb columns — wrap in an object.
      evidence: { items: done.evidence },
      status: "complete",
    }),
  });
  if (!res.ok) {
    console.error(
      "[analyze] persist failed",
      res.status,
      (await res.text()).slice(0, 300),
    );
    return null;
  }
  const data = (await res.json()) as { id?: string } | { id?: string }[];
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ?? null;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });
  const user = await validateUser(token);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
    });
  }
  const input = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await runAnalysis(input, (event) => {
          send(event);
          if (event.type === "complete") {
            // Persist after the client already has the full result.
            persistAnalysis(token, input, event)
              .then((id) => {
                if (id) send({ type: "saved", id });
              })
              .catch(() => {})
              .finally(() => controller.close());
          }
        });
      } catch (err) {
        try {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "Analysis failed",
          });
          controller.close();
        } catch {
          /* stream already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
