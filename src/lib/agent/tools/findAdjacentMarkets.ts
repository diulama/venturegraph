import { cypher } from "@/lib/neo4j";
import { GraphTool } from "../types";
import { FragmentBuilder } from "./helpers";

const CYPHER = `UNWIND $markets AS mname
MATCH (m:Market {name: mname})<-[:IN_MARKET]-(c:Company)-[:IN_MARKET]->(adj:Market)
WHERE adj.name <> m.name
RETURN m.name AS origin, adj.name AS adjacent, adj.blurb AS blurb,
       collect(DISTINCT c.name) AS via, count(DISTINCT c) AS strength
ORDER BY strength DESC LIMIT 10`;

interface Params {
  markets: string[];
}

interface Row {
  origin: string;
  adjacent: string;
  blurb: string | null;
  via: string[];
  strength: number;
}

export const findAdjacentMarkets: GraphTool<Params> = {
  name: "find_adjacent_markets",
  description:
    "Markets adjacent to the origin markets, bridged by companies operating in both",
  category: "Adjacent markets",
  progressLabel: () => "Walking 2-hop market adjacency",
  async run({ markets }) {
    const rows = await cypher<Row>(CYPHER, { markets });
    const b = new FragmentBuilder(
      "find_adjacent_markets",
      "Adjacent markets",
      CYPHER,
    );
    for (const r of rows) {
      const origin = b.node("Market", r.origin);
      const adj = b.node("Market", r.adjacent, r.blurb ?? undefined);
      for (const companyName of r.via) {
        const c = b.node("Company", companyName);
        b.link(c, "IN_MARKET", origin);
        b.link(c, "IN_MARKET", adj);
      }
      b.fact(
        `"${r.adjacent}" is adjacent to "${r.origin}" via ${r.via.join(", ")} (strength ${r.strength})`,
      );
    }
    return b.build();
  },
};
