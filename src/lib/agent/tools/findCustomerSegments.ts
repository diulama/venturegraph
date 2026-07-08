import { cypher } from "@/lib/neo4j";
import { GraphTool } from "../types";
import { FragmentBuilder } from "./helpers";

const BY_COMPANY = `UNWIND $companies AS cname
MATCH (c:Company {name: cname})-[:SERVES]->(s:CustomerSegment)
WITH s, collect(DISTINCT c.name) AS servedBy
RETURN s.name AS segment, servedBy, size(servedBy) AS density
ORDER BY density DESC`;

const BY_SEGMENT = `UNWIND $segments AS sname
MATCH (s:CustomerSegment {name: sname})<-[:SERVES]-(c:Company)
RETURN s.name AS segment, collect({name: c.name, tagline: c.tagline}) AS companies`;

interface Params {
  companies: string[];
  targetSegments: string[];
}

export const findCustomerSegments: GraphTool<Params> = {
  name: "find_customer_segments",
  description:
    "Segments served by the competitor set, plus every company already serving the founder's target segment",
  category: "Customer segments",
  progressLabel: () => "Traversing SERVES in both directions",
  async run({ companies, targetSegments }) {
    const [byCompany, bySegment] = await Promise.all([
      cypher<{ segment: string; servedBy: string[]; density: number }>(
        BY_COMPANY,
        {
          companies,
        },
      ),
      targetSegments.length
        ? cypher<{
            segment: string;
            companies: { name: string; tagline: string | null }[];
          }>(BY_SEGMENT, { segments: targetSegments })
        : Promise.resolve([]),
    ]);
    const b = new FragmentBuilder(
      "find_customer_segments",
      "Customer segments",
      BY_COMPANY,
    );
    for (const r of byCompany) {
      const s = b.node("CustomerSegment", r.segment);
      for (const companyName of r.servedBy) {
        const c = b.node("Company", companyName);
        b.link(c, "SERVES", s);
      }
      b.fact(`Segment "${r.segment}" is served by ${r.servedBy.join(", ")}`);
    }
    for (const r of bySegment) {
      const s = b.node("CustomerSegment", r.segment);
      for (const c of r.companies) {
        const cn = b.node("Company", c.name, c.tagline ?? undefined);
        b.link(cn, "SERVES", s);
      }
      b.fact(
        `Founder's target segment "${r.segment}" is already served by ${r.companies
          .map((c) => c.name)
          .join(", ")}`,
      );
    }
    return b.build();
  },
};
