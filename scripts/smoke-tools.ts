import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { toolRegistry } = await import("../src/lib/agent/tools");
  const { getDriver } = await import("../src/lib/neo4j");

  const scenarios: Record<string, unknown> = {
    search_entities: { keywords: ["AI", "code", "developer", "review"] },
    find_market_companies: {
      markets: ["AI Coding Assistants", "Foundation Models"],
    },
    find_competitors: { companies: ["Cursor", "GitHub"] },
    find_adjacent_markets: { markets: ["AI Coding Assistants"] },
    find_active_investors: {
      companies: ["Cursor", "Windsurf", "Replit", "GitHub"],
    },
    find_tech_stack: { companies: ["Cursor", "Windsurf", "Replit"] },
    find_customer_segments: {
      companies: ["Cursor", "Windsurf"],
      targetSegments: ["Enterprises"],
    },
    find_partnership_candidates: {
      companies: ["Cursor", "Windsurf"],
      targetSegments: ["Enterprises"],
    },
  };

  for (const [name, tool] of Object.entries(toolRegistry)) {
    const res = await tool.run(scenarios[name]);
    console.log(
      `✔ ${name}: ${res.facts.length} facts, ${res.graph.nodes.length} nodes, ${res.graph.links.length} links, ${res.evidence.length} evidence`,
    );
    for (const f of res.facts.slice(0, 2)) console.log(`   · ${f}`);
  }
  await getDriver().close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
