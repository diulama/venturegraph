import { cypher } from "@/lib/neo4j";
import { GraphTool } from "../types";
import { FragmentBuilder } from "./helpers";

const DIRECT_PARTNERS = `UNWIND $companies AS cname
MATCH (c:Company {name: cname})-[:PARTNERS_WITH]-(p:Company)
RETURN c.name AS company, p.name AS partner, p.tagline AS tagline`;

const ALLIES_OF_RIVALS = `UNWIND $companies AS cname
MATCH (c:Company {name: cname})-[:COMPETES_WITH]-(rival:Company)-[:PARTNERS_WITH]-(ally:Company)
WHERE ally.name <> c.name
  AND NOT (c)-[:COMPETES_WITH]-(ally)
  AND NOT ally.name IN $companies
RETURN DISTINCT ally.name AS ally, ally.tagline AS tagline,
       collect(DISTINCT rival.name) AS viaRivals`;

const SEGMENT_ALLIES = `UNWIND $segments AS sname
MATCH (s:CustomerSegment {name: sname})<-[:SERVES]-(ally:Company)
WHERE NOT ally.name IN $companies
  AND NOT EXISTS {
    MATCH (ally)-[:COMPETES_WITH]-(x:Company) WHERE x.name IN $companies
  }
RETURN ally.name AS ally, ally.tagline AS tagline, collect(DISTINCT s.name) AS sharedSegments
LIMIT 10`;

interface Params {
  companies: string[];
  targetSegments: string[];
}

export const findPartnershipCandidates: GraphTool<Params> = {
  name: "find_partnership_candidates",
  description:
    "Multi-hop partnership discovery: existing partner networks, non-competing allies of rivals, and companies serving the same segment without competing",
  category: "Partnerships",
  progressLabel: () => "Multi-hop PARTNERS_WITH path discovery",
  async run({ companies, targetSegments }) {
    const [direct, allies, segmentAllies] = await Promise.all([
      cypher<{ company: string; partner: string; tagline: string | null }>(
        DIRECT_PARTNERS,
        {
          companies,
        },
      ),
      cypher<{ ally: string; tagline: string | null; viaRivals: string[] }>(
        ALLIES_OF_RIVALS,
        {
          companies,
        },
      ),
      targetSegments.length
        ? cypher<{
            ally: string;
            tagline: string | null;
            sharedSegments: string[];
          }>(SEGMENT_ALLIES, { segments: targetSegments, companies })
        : Promise.resolve([]),
    ]);
    const b = new FragmentBuilder(
      "find_partnership_candidates",
      "Partnerships",
      ALLIES_OF_RIVALS,
    );
    for (const r of direct) {
      const c = b.node("Company", r.company);
      const p = b.node("Company", r.partner, r.tagline ?? undefined);
      b.link(c, "PARTNERS_WITH", p);
      b.fact(`${r.company} already partners with ${r.partner}`);
    }
    for (const r of allies) {
      const ally = b.node("Company", r.ally, r.tagline ?? undefined);
      for (const rivalName of r.viaRivals) {
        const rival = b.node("Company", rivalName);
        b.link(rival, "PARTNERS_WITH", ally);
      }
      b.fact(
        `${r.ally} partners with rival${r.viaRivals.length > 1 ? "s" : ""} ${r.viaRivals.join(", ")} but does not compete here — potential ally`,
      );
    }
    for (const r of segmentAllies) {
      const ally = b.node("Company", r.ally, r.tagline ?? undefined);
      for (const seg of r.sharedSegments) {
        const s = b.node("CustomerSegment", seg);
        b.link(ally, "SERVES", s);
      }
      b.fact(
        `${r.ally} serves the same target segment (${r.sharedSegments.join(", ")}) without competing — co-sell candidate`,
      );
    }
    return b.build();
  },
};
