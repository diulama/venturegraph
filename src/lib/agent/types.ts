export type NodeLabel =
  "Company" | "Investor" | "Technology" | "Market" | "CustomerSegment";

export type RelType =
  | "COMPETES_WITH"
  | "INVESTED_BY"
  | "USES_TECH"
  | "SERVES"
  | "PARTNERS_WITH"
  | "IN_MARKET";

export interface GraphNode {
  id: string; // `${label}:${name}`
  label: NodeLabel;
  name: string;
  tagline?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: RelType;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Evidence {
  id: string;
  category: string;
  tool: string;
  statement: string;
  triple: { from: string; rel: string; to: string };
  cypher: string;
}

export interface ToolResult {
  /** Concise fact lines fed to the LLM as context */
  facts: string[];
  graph: GraphData;
  evidence: Evidence[];
}

export interface GraphTool<P> {
  name: string;
  description: string;
  category: string;
  /** Human-readable progress label, e.g. "Traversing COMPETES_WITH" */
  progressLabel: (params: P) => string;
  run: (params: P) => Promise<ToolResult>;
}

export interface AnalysisInput {
  idea: string;
  targetCustomer: string;
  differentiator: string;
}

export interface Interpretation {
  keywords: string[];
  likelyMarkets: string[];
  targetSegments: string[];
  positioning: string;
}

export interface Reflection {
  expandMarkets: string[];
  focusCompanies: string[];
  rationale: string;
}

export type AgentEvent =
  | {
      type: "phase";
      phase: "interpret" | "explore" | "reflect" | "synthesize";
      detail: string;
    }
  | { type: "tool_start"; tool: string; label: string }
  | {
      type: "tool_result";
      tool: string;
      category: string;
      factCount: number;
      graph: GraphData;
      evidence: Evidence[];
    }
  | { type: "interpretation"; data: Interpretation }
  | { type: "reflection"; data: Reflection }
  | { type: "summary_delta"; text: string }
  | { type: "error"; message: string }
  | {
      type: "complete";
      graph: GraphData;
      evidence: Evidence[];
      summary: string;
    }
  | { type: "saved"; id: string };

/** Validated dark-mode categorical palette (dataviz skill, slots 1-5, fixed order). */
export const LABEL_COLORS: Record<NodeLabel, string> = {
  Company: "#3987e5",
  Investor: "#199e70",
  Technology: "#c98500",
  Market: "#008300",
  CustomerSegment: "#9085e9",
};

export const LABEL_DISPLAY: Record<NodeLabel, string> = {
  Company: "Company",
  Investor: "Investor",
  Technology: "Technology",
  Market: "Market",
  CustomerSegment: "Customer segment",
};

export function nodeId(label: NodeLabel, name: string): string {
  return `${label}:${name}`;
}
