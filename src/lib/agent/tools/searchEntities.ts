import { cypher } from "@/lib/neo4j";
import { GraphTool, NodeLabel } from "../types";
import { FragmentBuilder, luceneSanitize } from "./helpers";

const CYPHER = `CALL db.index.fulltext.queryNodes('entityNames', $q) YIELD node, score
RETURN labels(node)[0] AS label, node.name AS name,
       coalesce(node.tagline, node.blurb) AS desc, score
ORDER BY score DESC LIMIT 12`;

interface Params {
  keywords: string[];
}

interface Row {
  label: NodeLabel;
  name: string;
  desc: string | null;
  score: number;
}

export const searchEntities: GraphTool<Params> = {
  name: "search_entities",
  description:
    "Full-text search across companies, markets, technologies, and segments to anchor the analysis",
  category: "Anchors",
  progressLabel: (p) =>
    `Searching graph for "${p.keywords.slice(0, 4).join(", ")}"`,
  async run({ keywords }) {
    const q = keywords.map(luceneSanitize).filter(Boolean).join(" ");
    const rows = await cypher<Row>(CYPHER, { q });
    const b = new FragmentBuilder("search_entities", "Anchors", CYPHER);
    for (const r of rows) {
      b.node(r.label, r.name, r.desc ?? undefined);
      b.fact(`${r.label}: ${r.name}${r.desc ? ` — ${r.desc}` : ""}`);
    }
    return b.build();
  },
};
