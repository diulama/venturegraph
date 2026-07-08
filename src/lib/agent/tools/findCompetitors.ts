import { cypher } from "@/lib/neo4j";
import { GraphTool } from "../types";
import { FragmentBuilder } from "./helpers";

const DIRECT = `UNWIND $companies AS cname
MATCH (c:Company {name: cname})-[:COMPETES_WITH]-(rival:Company)
RETURN c.name AS company, rival.name AS rival, rival.tagline AS tagline`;

const IMPLICIT = `UNWIND $companies AS cname
MATCH (c:Company {name: cname})-[:IN_MARKET]->(m:Market)<-[:IN_MARKET]-(other:Company)
WHERE other.name <> c.name AND NOT (c)-[:COMPETES_WITH]-(other)
RETURN DISTINCT c.name AS company, m.name AS market, other.name AS rival, other.tagline AS tagline`;

interface Params {
  companies: string[];
}

export const findCompetitors: GraphTool<Params> = {
  name: "find_competitors",
  description: "Direct COMPETES_WITH rivals plus implicit shared-market rivals",
  category: "Competitors",
  progressLabel: () => "Traversing COMPETES_WITH edges",
  async run({ companies }) {
    const [direct, implicit] = await Promise.all([
      cypher<{ company: string; rival: string; tagline: string | null }>(
        DIRECT,
        { companies },
      ),
      cypher<{
        company: string;
        market: string;
        rival: string;
        tagline: string | null;
      }>(IMPLICIT, { companies }),
    ]);
    const b = new FragmentBuilder("find_competitors", "Competitors", DIRECT);
    for (const r of direct) {
      const c = b.node("Company", r.company);
      const rival = b.node("Company", r.rival, r.tagline ?? undefined);
      b.link(c, "COMPETES_WITH", rival);
      b.fact(`${r.company} competes directly with ${r.rival}`);
    }
    for (const r of implicit) {
      const c = b.node("Company", r.company);
      const m = b.node("Market", r.market);
      const rival = b.node("Company", r.rival, r.tagline ?? undefined);
      b.link(rival, "IN_MARKET", m);
      b.link(c, "IN_MARKET", m);
      b.fact(
        `${r.rival} shares the "${r.market}" market with ${r.company} (indirect rival)`,
      );
    }
    return b.build();
  },
};
