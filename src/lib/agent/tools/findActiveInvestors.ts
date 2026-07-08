import { cypher } from "@/lib/neo4j";
import { GraphTool } from "../types";
import { FragmentBuilder } from "./helpers";

const CYPHER = `UNWIND $companies AS cname
MATCH (c:Company {name: cname})-[:INVESTED_BY]->(i:Investor)
WITH i, collect(DISTINCT c.name) AS portfolio
RETURN i.name AS investor, portfolio, size(portfolio) AS overlap
ORDER BY overlap DESC`;

interface Params {
  companies: string[];
}

interface Row {
  investor: string;
  portfolio: string[];
  overlap: number;
}

export const findActiveInvestors: GraphTool<Params> = {
  name: "find_active_investors",
  description:
    "Investors backing the given companies, ranked by portfolio overlap in this space",
  category: "Investors",
  progressLabel: () => "Aggregating INVESTED_BY relationships",
  async run({ companies }) {
    const rows = await cypher<Row>(CYPHER, { companies });
    const b = new FragmentBuilder("find_active_investors", "Investors", CYPHER);
    for (const r of rows) {
      const inv = b.node("Investor", r.investor);
      for (const companyName of r.portfolio) {
        const c = b.node("Company", companyName);
        b.link(c, "INVESTED_BY", inv);
      }
      b.fact(
        `${r.investor} backs ${r.overlap} compan${r.overlap === 1 ? "y" : "ies"} in this space: ${r.portfolio.join(", ")}`,
      );
    }
    return b.build();
  },
};
