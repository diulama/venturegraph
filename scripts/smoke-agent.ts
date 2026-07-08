import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { runAnalysis } = await import("../src/lib/agent/orchestrator");
  const { getDriver } = await import("../src/lib/neo4j");

  let toolCalls = 0;
  let summary = "";
  await runAnalysis(
    {
      idea: "An AI-powered code review copilot that understands your entire codebase as a graph and flags architectural regressions before merge",
      targetCustomer: "Enterprise engineering teams",
      differentiator:
        "Graph-based whole-codebase reasoning instead of diff-only review",
    },
    (event) => {
      switch (event.type) {
        case "phase":
          console.log(`\n■ PHASE ${event.phase}: ${event.detail}`);
          break;
        case "tool_start":
          toolCalls++;
          console.log(`  → ${event.label}`);
          break;
        case "tool_result":
          console.log(
            `    ✔ ${event.tool} [${event.category}] +${event.graph.nodes.length}n/${event.graph.links.length}l, ${event.factCount} facts`,
          );
          break;
        case "interpretation":
          console.log("  interpretation:", JSON.stringify(event.data));
          break;
        case "reflection":
          console.log("  reflection:", JSON.stringify(event.data));
          break;
        case "complete":
          summary = event.summary;
          console.log(
            `\n■ COMPLETE: ${event.graph.nodes.length} nodes, ${event.graph.links.length} links, ${event.evidence.length} evidence entries, ${toolCalls} tool calls`,
          );
          break;
        case "error":
          console.error("  ✖ ERROR:", event.message);
          break;
      }
    },
  );
  console.log(
    "\n===== SUMMARY (first 600 chars) =====\n" + summary.slice(0, 600),
  );
  await getDriver().close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
