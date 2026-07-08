import { AnalysisInput, Interpretation } from "./types";

export const AGENT_ROLE =
  "a venture analyst who reasons over a startup-ecosystem knowledge graph. You never invent companies or relationships — you only interpret what graph traversals return";

export function interpretPrompt(
  input: AnalysisInput,
  vocabulary: { markets: string[]; segments: string[] },
) {
  return {
    instructions: [
      [
        "Task",
        "Classify a founder's startup idea against a knowledge graph's controlled vocabulary so graph traversals can be planned.",
      ],
      [
        "Output format",
        `Return JSON: {"keywords": string[3-6 short search terms], "likelyMarkets": string[1-3], "targetSegments": string[1-2], "positioning": string(one sentence)}. "likelyMarkets" MUST be chosen from the known markets list. "targetSegments" MUST be chosen from the known segments list. Keywords should be distinctive words from the idea useful for full-text search.`,
      ],
    ] as [string, string][],
    context: [
      `Known markets: ${vocabulary.markets.join(" | ")}`,
      `Known customer segments: ${vocabulary.segments.join(" | ")}`,
    ],
    question: `Founder's idea: "${input.idea}"\nTarget customer: "${input.targetCustomer}"\nDifferentiator: "${input.differentiator}"`,
  };
}

export function reflectPrompt(
  facts: string[],
  adjacentMarkets: string[],
  exploredMarkets: string[],
) {
  return {
    instructions: [
      [
        "Task",
        "You have completed a first round of graph traversals. Decide where a second, deeper traversal round would add the most insight for the founder.",
      ],
      [
        "Output format",
        `Return JSON: {"expandMarkets": string[0-2 markets to explore next, chosen ONLY from the adjacent-markets list], "focusCompanies": string[0-3 company names from the findings worth a deeper partnership scan], "rationale": string(one sentence explaining the choice)}. Choose markets NOT already explored. Return empty arrays if nothing is worth expanding.`,
      ],
    ] as [string, string][],
    context: [
      `Adjacent markets discovered (candidates for expansion): ${adjacentMarkets.join(" | ") || "none"}`,
      `Markets already explored: ${exploredMarkets.join(" | ")}`,
      `Graph findings so far:\n${facts.join("\n")}`,
    ],
    question: "Which adjacencies should the agent traverse next, and why?",
  };
}

export function synthesizePrompt(
  input: AnalysisInput,
  interp: Interpretation,
  facts: string[],
) {
  return {
    instructions: [
      [
        "Task",
        "Write the founder-facing analysis. Ground EVERY claim in the graph findings provided — cite companies, investors, and relationships by name. Do not invent entities that are not in the findings.",
      ],
      [
        "Output format",
        [
          "Markdown, no top-level title, using exactly these ## sections in order:",
          "## Positioning — 2-3 sentences on where this idea sits in the ecosystem.",
          "## Competitive landscape — direct and indirect rivals from the graph, what makes each dangerous.",
          "## Investors to target — investors ranked by portfolio overlap; explain the warm-intro logic.",
          "## Technology signals — what the competitor set builds on and what that implies.",
          "## Partnership opportunities — non-competing allies discovered via multi-hop paths; name the connecting path.",
          "## White space — the sharpest gap the graph reveals (markets/segments underserved), 2-3 sentences.",
          "Keep it under 450 words. Punchy, specific, founder-to-founder tone.",
        ].join("\n"),
      ],
    ] as [string, string][],
    context: [
      `Founder's idea: ${input.idea}`,
      `Target customer: ${input.targetCustomer}`,
      `Differentiator: ${input.differentiator}`,
      `Positioning hypothesis: ${interp.positioning}`,
      `Graph findings (${facts.length} facts from Neo4j traversals):\n${facts.join("\n")}`,
    ],
    question: "Write the analysis.",
  };
}
