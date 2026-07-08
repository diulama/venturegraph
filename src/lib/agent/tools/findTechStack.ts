import { cypher } from "@/lib/neo4j";
import { GraphTool } from "../types";
import { FragmentBuilder } from "./helpers";

const CYPHER = `UNWIND $companies AS cname
MATCH (c:Company {name: cname})-[:USES_TECH]->(t:Technology)
WITH t, collect(DISTINCT c.name) AS adopters
RETURN t.name AS tech, adopters, size(adopters) AS adoption
ORDER BY adoption DESC`;

interface Params {
  companies: string[];
}

interface Row {
  tech: string;
  adopters: string[];
  adoption: number;
}

export const findTechStack: GraphTool<Params> = {
  name: "find_tech_stack",
  description:
    "Technologies used across the given companies via USES_TECH, ranked by adoption",
  category: "Technology signals",
  progressLabel: () => "Aggregating USES_TECH adoption",
  async run({ companies }) {
    const rows = await cypher<Row>(CYPHER, { companies });
    const b = new FragmentBuilder(
      "find_tech_stack",
      "Technology signals",
      CYPHER,
    );
    for (const r of rows) {
      const t = b.node("Technology", r.tech);
      for (const companyName of r.adopters) {
        const c = b.node("Company", companyName);
        b.link(c, "USES_TECH", t);
      }
      b.fact(`${r.tech} is used by ${r.adopters.join(", ")}`);
    }
    return b.build();
  },
};
