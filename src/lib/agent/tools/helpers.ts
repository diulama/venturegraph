import {
  Evidence,
  GraphData,
  GraphLink,
  GraphNode,
  NodeLabel,
  RelType,
  nodeId,
} from "../types";

let evidenceCounter = 0;

export class FragmentBuilder {
  private nodes = new Map<string, GraphNode>();
  private links = new Map<string, GraphLink>();
  private evidence: Evidence[] = [];
  private facts: string[] = [];

  constructor(
    private tool: string,
    private category: string,
    private cypherText: string,
  ) {}

  node(label: NodeLabel, name: string, tagline?: string): GraphNode {
    const id = nodeId(label, name);
    const existing = this.nodes.get(id);
    if (existing) {
      if (tagline && !existing.tagline) existing.tagline = tagline;
      return existing;
    }
    const n: GraphNode = { id, label, name, ...(tagline ? { tagline } : {}) };
    this.nodes.set(id, n);
    return n;
  }

  link(from: GraphNode, rel: RelType, to: GraphNode, statement?: string) {
    const key = `${from.id}|${rel}|${to.id}`;
    if (!this.links.has(key)) {
      this.links.set(key, { source: from.id, target: to.id, type: rel });
      this.evidence.push({
        id: `ev_${++evidenceCounter}`,
        category: this.category,
        tool: this.tool,
        statement:
          statement ?? `${from.name} ${rel.replaceAll("_", " ")} ${to.name}`,
        triple: { from: from.name, rel, to: to.name },
        cypher: this.cypherText,
      });
    }
  }

  fact(line: string) {
    this.facts.push(line);
  }

  build(): { facts: string[]; graph: GraphData; evidence: Evidence[] } {
    return {
      facts: this.facts,
      graph: {
        nodes: [...this.nodes.values()],
        links: [...this.links.values()],
      },
      evidence: this.evidence,
    };
  }
}

/** Strip Lucene special characters so free text is safe for a fulltext query. */
export function luceneSanitize(term: string): string {
  return term.replace(/[+\-!(){}\[\]^"~*?:\\\/&|]/g, " ").trim();
}
