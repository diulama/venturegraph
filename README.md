# VentureGraph

**Reason over the startup ecosystem — don't just search it.**

VentureGraph is a graph-aware AI founder assistant built for **HackwithBay 3.0**. A founder describes their idea, target customer, and differentiator; an AI agent then **traverses a Neo4j knowledge graph of the startup ecosystem** — companies, investors, technologies, markets, customer segments — and reasons over relationships (not embeddings) to surface competitors, warm investor paths, technology signals, and partnership white space. Results stream live into an interactive force-graph with a per-relationship evidence panel.

## Why graph reasoning, not semantic search

Semantic search answers _"what text looks similar to my idea?"_ VentureGraph answers _"who competes with whom, who funds them, and which non-competing company partners with my rivals?"_ — questions that are **only answerable by walking edges**:

```cypher
// "Partnership white space": companies that partner with my rivals but don't compete with me
MATCH (me:Company)-[:COMPETES_WITH]-(rival)-[:PARTNERS_WITH]-(ally)
WHERE NOT (me)-[:COMPETES_WITH]-(ally)
RETURN ally, collect(rival) AS viaRivals
```

Every analysis runs **11+ tool invocations (15+ Cypher traversals)**, each seeded by the results of the previous one, with an LLM reflection step in the middle that decides where to traverse deeper.

## Architecture

```
Browser ── Next.js (App Router, Tailwind v4)
              │  POST /api/analyze → NDJSON event stream
              ▼
        Agent orchestrator (4 phases)
        ├─ A Interpret ──► RocketRide Cloud pipeline ──► Butterbase AI gateway (LLM)
        ├─ B Explore ────► Neo4j: 8-tool traversal battery (dependent Cypher)
        ├─ C Reflect ────► RocketRide pipeline decides round-2 traversals
        ├─ D Synthesize ─► RocketRide pipeline writes the grounded report
        └─ Persist ──────► Butterbase DB (analyses table, RLS user isolation)
```

### Sponsor technology integration (all load-bearing)

| Technology           | Role                                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Butterbase**       | End-user auth (email/password JWT), `analyses` persistence with row-level security, and the **AI model gateway that serves every LLM token** the agent consumes                                                                                                                                             |
| **Neo4j**            | The ecosystem property graph _is_ the product: 75 nodes, 327 relationships across 6 edge types. The agent's reasoning is driven by parameterized Cypher traversals — full-text anchoring, shared-market inference, 2-hop market adjacency, investor portfolio overlap, and 3-hop partnership-path discovery |
| **RocketRide Cloud** | Every reasoning phase (interpret / reflect / synthesize) executes through `pipelines/venturegraph.pipe` (chat → `llm_openai_api` → response) on api.rocketride.ai via the `rocketride` SDK — production endpoints with observable runs                                                                    |

The graph-tool layer is a **registry** (`src/lib/agent/tools/`): each tool declares its Cypher, params, and evidence mapping, so new tools — or entirely new agents — plug in without touching the orchestrator.

## The agent loop

1. **Interpret** — the LLM grounds the founder's free-text idea against the graph's _actual_ vocabulary (market/segment names fetched from Neo4j) → keywords, candidate markets, target segments.
2. **Explore** — dependent traversal battery: full-text anchors → market companies → competitors (direct + shared-market) → adjacent markets → investor overlap → tech adoption → segment coverage → partnership paths.
3. **Reflect** — the LLM reviews all graph facts and _chooses_ up to two adjacent markets and focus companies for a second traversal round.
4. **Synthesize** — a grounded markdown report (positioning, competitive landscape, investors to target, tech signals, partnership opportunities, white space). Every claim traces to an evidence entry with its Cypher provenance.

## Running locally

```bash
npm install

# Neo4j (Docker) + seed
neo4j-cli docker create --name venturegraph --bolt-port 7688 --http-port 7475
npx tsx scripts/seed.ts

npm run dev   # http://localhost:3000
```

`.env.local` requires:

```
BUTTERBASE_APP_ID / BUTTERBASE_API_URL / BUTTERBASE_SERVICE_KEY
NEXT_PUBLIC_BUTTERBASE_APP_ID / NEXT_PUBLIC_BUTTERBASE_API_URL
LLM_BASE_URL / LLM_API_KEY / LLM_MODEL      # Butterbase AI gateway
NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD
ROCKETRIDE_URI / ROCKETRIDE_APIKEY          # RocketRide Cloud
```

Without `ROCKETRIDE_APIKEY` the agent falls back to calling the Butterbase gateway directly (dev convenience only — the demo path runs through RocketRide Cloud).

### Scripts

| Script                           | Purpose                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `npx tsx scripts/seed.ts`        | Idempotent graph seed (constraints, full-text index, 75 nodes) |
| `npx tsx scripts/smoke-tools.ts` | Exercise all 8 graph tools                                     |
| `npx tsx scripts/smoke-agent.ts` | Full agent run in the terminal                                 |
| `npx tsx scripts/e2e-api.ts`     | Headless E2E: signup → stream → persistence → RLS check        |

## Demo script (2 minutes)

1. Sign in → dashboard → **Try an example** (AI code-review copilot for enterprise eng teams).
2. **Run graph analysis** — watch the phase ticker ("Traversing COMPETES_WITH…") while the force-graph **grows in real time** as each traversal returns.
3. Point out the agent's reflection: it _chose_ which adjacent markets to expand (visible in the activity feed).
4. Click **GitHub** in the graph → evidence panel filters to its relationships; expand one to show the **actual Cypher** that discovered it.
5. Read the "Partnership opportunities" section — every name arrived via a multi-hop graph path, not a text match.
6. Refresh — the analysis reloads from Butterbase (RLS-scoped permalink).

## Future work

- Autonomous tool-calling loop (the registry is already shaped for it)
- Cognee for persistent agent memory across analyses; Daytona sandboxes for executing generated diligence scripts
- Live data connectors (Crunchbase/PitchBook) writing into the same graph schema
