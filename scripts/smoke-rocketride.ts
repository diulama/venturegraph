import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { createLlm } = await import("../src/lib/agent/llm");
  const llm = createLlm();
  console.log("LLM mode:", llm.mode);
  if (llm.mode !== "rocketride") {
    throw new Error(
      "Expected rocketride mode — is ROCKETRIDE_APIKEY set in .env.local?",
    );
  }

  console.log("Asking RocketRide a JSON question…");
  const t0 = Date.now();
  const answer = await llm.ask({
    role: "a test assistant",
    instructions: [
      ["Output format", 'Return JSON: {"ok": true, "echo": string}'],
    ],
    question: 'Reply with ok=true and echo="venturegraph".',
    expectJson: true,
  });
  console.log(`Answer (${Date.now() - t0}ms):`, answer);
  await llm.close();
  console.log("✅ RocketRide reasoning path works");
}

main().catch((e) => {
  console.error("❌ RocketRide test failed:", e?.message || e);
  process.exit(1);
});
