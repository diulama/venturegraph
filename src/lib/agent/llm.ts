import fs from "fs";
import path from "path";
import { PipelineConfig, Question, RocketRideClient } from "rocketride";

/**
 * Load the .pipe file, unwrap the { pipeline } envelope, and resolve every
 * ${ROCKETRIDE_*} placeholder from `vars` in code — we don't rely on the
 * server's placeholder substitution (it left the model empty).
 */
function loadResolvedPipeline(vars: Record<string, string>): PipelineConfig {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "pipelines", "venturegraph.pipe"),
    "utf-8",
  );
  const resolved = raw.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, key: string) => {
    if (vars[key] == null)
      throw new Error(`Pipeline references undefined var \${${key}}`);
    return vars[key];
  });
  const parsed = JSON.parse(resolved) as {
    pipeline?: PipelineConfig;
  } & PipelineConfig;
  return parsed.pipeline ?? parsed;
}

type RocketRideChatResult = Record<string, unknown> & {
  answers?: unknown[];
  result_types?: Record<string, string>;
};

function extractRocketRideAnswer(result: RocketRideChatResult): unknown {
  const answerKey = Object.entries(result.result_types ?? {}).find(
    ([, laneType]) => laneType === "answers",
  )?.[0];
  const mappedAnswers = answerKey ? result[answerKey] : undefined;
  if (Array.isArray(mappedAnswers) && mappedAnswers.length)
    return mappedAnswers;
  if (Array.isArray(result.answers) && result.answers.length)
    return result.answers;
  return undefined;
}

function answerToText(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw
      .map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      )
      .join("\n");
  }
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const unfenced = fenced?.[1] ?? text;
  const object = unfenced.match(/\{[\s\S]*\}/);
  return (object?.[0] ?? unfenced).trim();
}

export interface AskOptions {
  role: string;
  instructions: [title: string, text: string][];
  context?: string[];
  question: string;
  expectJson?: boolean;
  onDelta?: (text: string) => void;
}

/**
 * LLM reasoning interface. The production implementation runs every call
 * through a RocketRide Cloud pipeline; a direct Butterbase-gateway fallback
 * exists purely for local development before cloud credentials are wired.
 */
export interface LlmClient {
  readonly mode: "rocketride" | "gateway";
  ask(opts: AskOptions): Promise<string>;
  close(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* RocketRide Cloud — production reasoning path                        */
/* ------------------------------------------------------------------ */

export class RocketRideLlm implements LlmClient {
  readonly mode = "rocketride" as const;
  private client: RocketRideClient | null = null;
  private token: string | null = null;

  private async ensureSession(): Promise<{
    client: RocketRideClient;
    token: string;
  }> {
    if (this.client && this.token)
      return { client: this.client, token: this.token };
    const pipeline = loadResolvedPipeline({
      ROCKETRIDE_LLM_BASE_URL: process.env.LLM_BASE_URL!,
      ROCKETRIDE_LLM_APIKEY: process.env.LLM_API_KEY!,
      ROCKETRIDE_LLM_MODEL: process.env.LLM_MODEL!,
    });
    const client = new RocketRideClient({
      auth: process.env.ROCKETRIDE_APIKEY!,
      uri: process.env.ROCKETRIDE_URI || "https://api.rocketride.ai",
    });
    await client.connect();
    const { token } = await client.use({
      pipeline,
      name: "venturegraph-agent",
      useExisting: true,
    });
    this.client = client;
    this.token = token;
    return { client, token };
  }

  async ask(opts: AskOptions): Promise<string> {
    const { client, token } = await this.ensureSession();
    const question = new Question({
      expectJson: !!opts.expectJson,
      role: opts.role,
    });
    for (const [title, text] of opts.instructions)
      question.addInstruction(title, text);
    if (opts.context?.length) question.addContext(opts.context);
    question.addQuestion(opts.question);

    const result = (await client.chat({ token, question })) as RocketRideChatResult;
    const raw = extractRocketRideAnswer(result);
    if (raw == null) throw new Error("RocketRide pipeline returned no answer");

    const text = opts.expectJson
      ? stripJsonFences(answerToText(raw))
      : answerToText(raw);
    opts.onDelta?.(text);
    return text;
  }

  async close() {
    if (this.client && this.token) {
      await this.client.terminate(this.token).catch(() => {});
      await this.client.disconnect().catch(() => {});
    }
    this.client = null;
    this.token = null;
  }
}

/* ------------------------------------------------------------------ */
/* Butterbase gateway direct — local-dev fallback only                 */
/* ------------------------------------------------------------------ */

export class GatewayLlm implements LlmClient {
  readonly mode = "gateway" as const;

  async ask(opts: AskOptions): Promise<string> {
    const system = [
      `You are ${opts.role}.`,
      ...opts.instructions.map(([title, text]) => `## ${title}\n${text}`),
      opts.expectJson
        ? "Respond with a single valid JSON object only. No prose, no markdown fences."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const user = [
      ...(opts.context?.length ? [`Context:\n${opts.context.join("\n")}`] : []),
      opts.question,
    ].join("\n\n");

    const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 4000,
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Gateway LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    let text = json.choices[0]?.message?.content ?? "";
    if (opts.expectJson) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
    }
    opts.onDelta?.(text);
    return text;
  }

  async close() {}
}

export function createLlm(): LlmClient {
  if (process.env.ROCKETRIDE_APIKEY) return new RocketRideLlm();
  console.warn(
    "[venturegraph] ROCKETRIDE_APIKEY not set — using direct gateway fallback (dev only).",
  );
  return new GatewayLlm();
}
