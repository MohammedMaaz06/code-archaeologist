import type { GraphNode, KnowledgeGraphData } from "@/lib/api";

/** Everything here is derived from the exported graph; nothing is estimated or invented. */

export interface Hotspot {
  node: GraphNode;
  /** Incoming non-structural edges (callers, importers, subclasses). */
  dependents: number;
  /** Outgoing non-structural edges (callees, imports, bases). */
  dependencies: number;
}

export interface FileStat {
  file: string;
  symbols: number;
}

export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  /** Nodes that are not files (functions, classes, ...). */
  symbolCount: number;
  /** Average edges touching a node (in + out). */
  avgConnections: number;
  /** Nodes with no edges at all. */
  isolated: number;
  typeCounts: [string, number][];
  relCounts: [string, number][];
  hotspots: Hotspot[];
  files: FileStat[];
}

const STRUCTURAL = "contains";

/** Best-effort owning file of a node: explicit path, `file::symbol` id prefix, or the file node itself. */
export function fileOf(n: GraphNode): string | undefined {
  if (n.filePath) return n.filePath;
  if (n.id.includes("::")) return n.id.split("::")[0];
  return n.type === "file" ? n.id : undefined;
}

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const sorted = (m: Map<string, number>): [string, number][] => [...m.entries()].sort((a, b) => b[1] - a[1]);

export function analyzeGraph(graph: KnowledgeGraphData, topHotspots = 8, topFiles = 6): GraphAnalytics {
  const degree = new Map<string, number>();
  const dependents = new Map<string, number>();
  const dependencies = new Map<string, number>();
  const rels = new Map<string, number>();

  for (const e of graph.edges) {
    bump(degree, e.source);
    bump(degree, e.target);
    bump(rels, e.relationship);
    if (e.relationship !== STRUCTURAL) {
      bump(dependents, e.target);
      bump(dependencies, e.source);
    }
  }

  const types = new Map<string, number>();
  const files = new Map<string, number>();
  let isolated = 0;
  let symbolCount = 0;
  const hotspots: Hotspot[] = [];

  for (const n of graph.nodes) {
    bump(types, n.type);
    if (!degree.has(n.id)) isolated++;
    if (n.type !== "file") {
      symbolCount++;
      const f = fileOf(n);
      if (f) bump(files, f);
    }
    const d = dependents.get(n.id) ?? 0;
    if (d > 0) hotspots.push({ node: n, dependents: d, dependencies: dependencies.get(n.id) ?? 0 });
  }

  hotspots.sort((a, b) => b.dependents - a.dependents || b.dependencies - a.dependencies || a.node.label.localeCompare(b.node.label));

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    symbolCount,
    avgConnections: graph.nodes.length ? (graph.edges.length * 2) / graph.nodes.length : 0,
    isolated,
    typeCounts: sorted(types),
    relCounts: sorted(rels),
    hotspots: hotspots.slice(0, topHotspots),
    files: sorted(files).slice(0, topFiles).map(([file, symbols]) => ({ file, symbols })),
  };
}
