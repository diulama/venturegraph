import { cypher } from "@/lib/neo4j";
import { GraphTool } from "../types";
import { FragmentBuilder } from "./helpers";

const CYPHER = `UNWIND $markets AS mname
MATCH (m:Market {name: mname})<-[:IN_MARKET]-(c:Company)
RETURN m.name AS market, m.blurb AS blurb,
       collect({name: c.name, tagline: c.tagline}) AS companies`;

interface Params {
  markets: string[];
}

interface Row {
  market: string;
  blurb: string | null;
  companies: { name: string; tagline: string | null }[];
}

export const findMarketCompanies: GraphTool<Params> = {
  name: "find_market_companies",
  description: "Companies operating in the given markets via IN_MARKET",
  category: "Market landscape",
  progressLabel: (p) => `Mapping companies in ${p.markets.join(", ")}`,
  async run({ markets }) {
    const rows = await cypher<Row>(CYPHER, { markets });
    const b = new FragmentBuilder(
      "find_market_companies",
      "Market landscape",
      CYPHER,
    );
    for (const r of rows) {
      const m = b.node("Market", r.market, r.blurb ?? undefined);
      for (const c of r.companies) {
        const cn = b.node("Company", c.name, c.tagline ?? undefined);
        b.link(cn, "IN_MARKET", m);
      }
      b.fact(
        `Market "${r.market}": ${r.companies.map((c) => c.name).join(", ")}`,
      );
    }
    return b.build();
  },
};
