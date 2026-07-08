import { config } from "dotenv";
import neo4j from "neo4j-driver";
import {
  companies,
  investors,
  markets,
  segments,
  technologies,
} from "./seed-data";

config({ path: ".env.local" });

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!),
);

async function run(cypher: string, params: Record<string, unknown> = {}) {
  const session = driver.session();
  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}

async function main() {
  console.log("Creating constraints and indexes...");
  const labels = [
    "Company",
    "Investor",
    "Technology",
    "Market",
    "CustomerSegment",
  ];
  for (const label of labels) {
    await run(
      `CREATE CONSTRAINT ${label.toLowerCase()}_name IF NOT EXISTS FOR (n:${label}) REQUIRE n.name IS UNIQUE`,
    );
  }
  await run(
    `CREATE FULLTEXT INDEX entityNames IF NOT EXISTS
     FOR (n:Company|Market|Technology|CustomerSegment)
     ON EACH [n.name, n.tagline, n.blurb]`,
  );

  console.log("Seeding nodes...");
  await run(
    `UNWIND $rows AS row MERGE (m:Market {name: row.name}) SET m.blurb = row.blurb`,
    { rows: markets },
  );
  await run(`UNWIND $names AS name MERGE (:CustomerSegment {name: name})`, {
    names: segments,
  });
  await run(`UNWIND $names AS name MERGE (:Technology {name: name})`, {
    names: technologies,
  });
  await run(`UNWIND $names AS name MERGE (:Investor {name: name})`, {
    names: investors,
  });
  await run(
    `UNWIND $rows AS row MERGE (c:Company {name: row.name}) SET c.tagline = row.tagline`,
    { rows: companies.map((c) => ({ name: c.name, tagline: c.tagline })) },
  );

  console.log("Seeding relationships...");
  for (const c of companies) {
    await run(
      `MATCH (c:Company {name: $name})
       UNWIND $markets AS m
       MATCH (t:Market {name: m})
       MERGE (c)-[:IN_MARKET]->(t)`,
      { name: c.name, markets: c.markets },
    );
    await run(
      `MATCH (c:Company {name: $name})
       UNWIND $tech AS m
       MATCH (t:Technology {name: m})
       MERGE (c)-[:USES_TECH]->(t)`,
      { name: c.name, tech: c.tech },
    );
    await run(
      `MATCH (c:Company {name: $name})
       UNWIND $serves AS m
       MATCH (t:CustomerSegment {name: m})
       MERGE (c)-[:SERVES]->(t)`,
      { name: c.name, serves: c.serves },
    );
    await run(
      `MATCH (c:Company {name: $name})
       UNWIND $investors AS m
       MATCH (t:Investor {name: m})
       MERGE (c)-[:INVESTED_BY]->(t)`,
      { name: c.name, investors: c.investors },
    );
    // Canonical direction (alphabetical) so undirected matches never see duplicate pairs
    await run(
      `MATCH (c:Company {name: $name})
       UNWIND $others AS o
       MATCH (d:Company {name: o})
       WITH CASE WHEN c.name < d.name THEN c ELSE d END AS a,
            CASE WHEN c.name < d.name THEN d ELSE c END AS b
       MERGE (a)-[:COMPETES_WITH]->(b)`,
      { name: c.name, others: c.competesWith },
    );
    await run(
      `MATCH (c:Company {name: $name})
       UNWIND $others AS o
       MATCH (d:Company {name: o})
       WITH CASE WHEN c.name < d.name THEN c ELSE d END AS a,
            CASE WHEN c.name < d.name THEN d ELSE c END AS b
       MERGE (a)-[:PARTNERS_WITH]->(b)`,
      { name: c.name, others: c.partnersWith },
    );
  }

  const counts = await run(
    `CALL () { MATCH (n) RETURN count(n) AS nodes }
     CALL () { MATCH ()-[r]->() RETURN count(r) AS rels }
     RETURN nodes, rels`,
  );
  const rec = counts.records[0];
  console.log(
    `Done. ${rec.get("nodes")} nodes, ${rec.get("rels")} relationships.`,
  );

  // Sanity: every seeded name must resolve (catch typos in cross-references)
  const missing = await run(
    `UNWIND $pairs AS p
     OPTIONAL MATCH (c:Company {name: p})
     WITH p, c WHERE c IS NULL
     RETURN collect(p) AS missing`,
    {
      pairs: [
        ...new Set(
          companies.flatMap((c) => [...c.competesWith, ...c.partnersWith]),
        ),
      ],
    },
  );
  const miss = missing.records[0].get("missing");
  if (miss.length) console.warn("⚠️ Unresolved company references:", miss);
  else console.log("All cross-references resolved.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => driver.close());
