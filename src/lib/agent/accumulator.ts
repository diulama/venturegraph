import { Evidence, GraphData, GraphLink, GraphNode, ToolResult } from "./types";

/** Merges tool-result fragments into one deduplicated graph + evidence log. */
export class Accumulator {
  private nodes = new Map<string, GraphNode>();
  private links = new Map<string, GraphLink>();
  private evidenceList: Evidence[] = [];
  private evidenceKeys = new Set<string>();
  private factLog: string[] = [];

  add(result: ToolResult): { newNodes: number; newLinks: number } {
    let newNodes = 0;
    let newLinks = 0;
    for (const n of result.graph.nodes) {
      const existing = this.nodes.get(n.id);
      if (!existing) {
        this.nodes.set(n.id, { ...n });
        newNodes++;
      } else if (n.tagline && !existing.tagline) {
        existing.tagline = n.tagline;
      }
    }
    for (const l of result.graph.links) {
      const key = `${l.source}|${l.type}|${l.target}`;
      const reverseKey = `${l.target}|${l.type}|${l.source}`;
      if (!this.links.has(key) && !this.links.has(reverseKey)) {
        this.links.set(key, { ...l });
        newLinks++;
      }
    }
    for (const ev of result.evidence) {
      const key = `${ev.triple.from}|${ev.triple.rel}|${ev.triple.to}|${ev.category}`;
      if (!this.evidenceKeys.has(key)) {
        this.evidenceKeys.add(key);
        this.evidenceList.push(ev);
      }
    }
    this.factLog.push(...result.facts);
    return { newNodes, newLinks };
  }

  get graph(): GraphData {
    return { nodes: [...this.nodes.values()], links: [...this.links.values()] };
  }

  get evidence(): Evidence[] {
    return this.evidenceList;
  }

  get facts(): string[] {
    return this.factLog;
  }

  companyNames(): string[] {
    return [...this.nodes.values()]
      .filter((n) => n.label === "Company")
      .map((n) => n.name);
  }
}
