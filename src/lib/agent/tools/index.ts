import { GraphTool } from "../types";
import { searchEntities } from "./searchEntities";
import { findMarketCompanies } from "./findMarketCompanies";
import { findCompetitors } from "./findCompetitors";
import { findAdjacentMarkets } from "./findAdjacentMarkets";
import { findActiveInvestors } from "./findActiveInvestors";
import { findTechStack } from "./findTechStack";
import { findCustomerSegments } from "./findCustomerSegments";
import { findPartnershipCandidates } from "./findPartnershipCandidates";

export {
  searchEntities,
  findMarketCompanies,
  findCompetitors,
  findAdjacentMarkets,
  findActiveInvestors,
  findTechStack,
  findCustomerSegments,
  findPartnershipCandidates,
};

/**
 * Registry of every graph tool the agent can invoke.
 * New tools (or whole new agents) plug in here without touching the orchestrator.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolRegistry: Record<string, GraphTool<any>> = Object.fromEntries(
  [
    searchEntities,
    findMarketCompanies,
    findCompetitors,
    findAdjacentMarkets,
    findActiveInvestors,
    findTechStack,
    findCustomerSegments,
    findPartnershipCandidates,
  ].map((t) => [t.name, t]),
);
