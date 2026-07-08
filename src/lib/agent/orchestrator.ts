import { z } from "zod";
import { cypher } from "@/lib/neo4j";
import { Accumulator } from "./accumulator";
import { createLlm, LlmClient } from "./llm";
import {
  AGENT_ROLE,
  interpretPrompt,
  reflectPrompt,
  synthesizePrompt,
} from "./prompts";
import {
  findActiveInvestors,
  findAdjacentMarkets,
  findCompetitors,
  findCustomerSegments,
  findMarketCompanies,
  findPartnershipCandidates,
  findTechStack,
  searchEntities,
} from "./tools";
import {
  AgentEvent,
  AnalysisInput,
  GraphTool,
  Interpretation,
  Reflection,
  ToolResult,
} from "./types";

const interpretationSchema = z.object({
  keywords: z.array(z.string()).min(1),
  likelyMarkets: z.array(z.string()),
  targetSegments: z.array(z.string()),
  positioning: z.string(),
});

const reflectionSchema = z.object({
  expandMarkets: z.array(z.string()),
  focusCompanies: z.array(z.string()),
  rationale: z.string(),
});

async function askJson<T>(
  llm: LlmClient,
  prompt: {
    instructions: [string, string][];
    context?: string[];
    question: string;
  },
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await llm.ask({ role: AGENT_ROLE, expectJson: true, ...prompt });
  return schema.parse(JSON.parse(raw));
}

const cap = (arr: string[], n: number) => [...new Set(arr)].slice(0, n);

export async function runAnalysis(
  input: AnalysisInput,
  emit: (event: AgentEvent) => void,
): Promise<void> {
  const llm = createLlm();
  const acc = new Accumulator();

  const runTool = async <P>(
    tool: GraphTool<P>,
    params: P,
  ): Promise<ToolResult> => {
    emit({
      type: "tool_start",
      tool: tool.name,
      label: tool.progressLabel(params),
    });
    const result = await tool.run(params);
    acc.add(result);
    emit({
      type: "tool_result",
      tool: tool.name,
      category: tool.category,
      factCount: result.facts.length,
      graph: result.graph,
      evidence: result.evidence,
    });
    return result;
  };

  try {
    /* Phase A — Interpret: ground the idea in the graph's controlled vocabulary */
    emit({
      type: "phase",
      phase: "interpret",
      detail: "Grounding the idea in the ecosystem graph",
    });
    const [marketRows, segmentRows] = await Promise.all([
      cypher<{ name: string }>(
        "MATCH (m:Market) RETURN m.name AS name ORDER BY name",
      ),
      cypher<{ name: string }>(
        "MATCH (s:CustomerSegment) RETURN s.name AS name ORDER BY name",
      ),
    ]);
    const vocabulary = {
      markets: marketRows.map((r) => r.name),
      segments: segmentRows.map((r) => r.name),
    };
    const interp: Interpretation = await askJson(
      llm,
      interpretPrompt(input, vocabulary),
      interpretationSchema,
    );
    interp.likelyMarkets = interp.likelyMarkets.filter((m) =>
      vocabulary.markets.includes(m),
    );
    interp.targetSegments = interp.targetSegments.filter((s) =>
      vocabulary.segments.includes(s),
    );
    emit({ type: "interpretation", data: interp });

    /* Phase B — Explore: dependent traversal battery */
    emit({
      type: "phase",
      phase: "explore",
      detail: "Traversing the ecosystem graph",
    });
    const anchors = await runTool(searchEntities, {
      keywords: interp.keywords,
    });
    const anchorMarkets = anchors.graph.nodes
      .filter((n) => n.label === "Market")
      .map((n) => n.name);
    const markets = cap([...interp.likelyMarkets, ...anchorMarkets], 3);

    const marketCompanies = await runTool(findMarketCompanies, { markets });
    const coreCompanies = cap(
      [
        ...marketCompanies.graph.nodes
          .filter((n) => n.label === "Company")
          .map((n) => n.name),
        ...anchors.graph.nodes
          .filter((n) => n.label === "Company")
          .map((n) => n.name),
      ],
      8,
    );

    const competitors = await runTool(findCompetitors, {
      companies: coreCompanies,
    });
    const competitorSet = cap(
      [
        ...coreCompanies,
        ...competitors.graph.nodes
          .filter((n) => n.label === "Company")
          .map((n) => n.name),
      ],
      12,
    );

    const adjacency = await runTool(findAdjacentMarkets, { markets });
    await runTool(findActiveInvestors, { companies: competitorSet });
    await runTool(findTechStack, { companies: competitorSet });
    await runTool(findCustomerSegments, {
      companies: competitorSet,
      targetSegments: interp.targetSegments,
    });
    await runTool(findPartnershipCandidates, {
      companies: competitorSet,
      targetSegments: interp.targetSegments,
    });

    /* Phase C — Reflect: the agent decides where to traverse deeper */
    emit({
      type: "phase",
      phase: "reflect",
      detail: "Agent reviewing findings to plan round two",
    });
    const adjacentMarketNames = adjacency.graph.nodes
      .filter((n) => n.label === "Market" && !markets.includes(n.name))
      .map((n) => n.name);
    let reflection: Reflection = {
      expandMarkets: [],
      focusCompanies: [],
      rationale: "",
    };
    try {
      reflection = await askJson(
        llm,
        reflectPrompt(acc.facts, adjacentMarketNames, markets),
        reflectionSchema,
      );
      reflection.expandMarkets = cap(
        reflection.expandMarkets.filter((m) => adjacentMarketNames.includes(m)),
        2,
      );
      reflection.focusCompanies = cap(
        reflection.focusCompanies.filter((c) => acc.companyNames().includes(c)),
        3,
      );
    } catch {
      // Reflection is best-effort; a malformed reply must not sink the analysis.
    }
    emit({ type: "reflection", data: reflection });

    if (reflection.expandMarkets.length) {
      const expansion = await runTool(findMarketCompanies, {
        markets: reflection.expandMarkets,
      });
      const expansionCompanies = cap(
        expansion.graph.nodes
          .filter((n) => n.label === "Company")
          .map((n) => n.name),
        6,
      );
      if (expansionCompanies.length) {
        await runTool(findCompetitors, { companies: expansionCompanies });
      }
    }
    if (reflection.focusCompanies.length) {
      await runTool(findPartnershipCandidates, {
        companies: reflection.focusCompanies,
        targetSegments: interp.targetSegments,
      });
    }

    /* Phase D — Synthesize */
    emit({
      type: "phase",
      phase: "synthesize",
      detail: "Writing the founder analysis",
    });
    const summary = await llm.ask({
      role: AGENT_ROLE,
      ...synthesizePrompt(input, interp, acc.facts),
      onDelta: (text) => emit({ type: "summary_delta", text }),
    });

    emit({
      type: "complete",
      graph: acc.graph,
      evidence: acc.evidence,
      summary,
    });
  } catch (err) {
    emit({
      type: "error",
      message:
        err instanceof Error ? err.message : "Analysis failed unexpectedly",
    });
    throw err;
  } finally {
    await llm.close();
  }
}
