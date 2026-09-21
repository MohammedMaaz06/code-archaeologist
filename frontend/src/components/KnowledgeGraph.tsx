"use client";

import React, { useEffect, useRef, useState } from "react";
import cytoscape, { Core, NodeSingular } from "cytoscape";
import dagre from "cytoscape-dagre";

// Register layout extension
if (typeof window !== "undefined") {
  cytoscape.use(dagre);
}

export interface GraphNode {
  id: string;
  label: string;
  type: "function" | "class" | "module" | "variable";
  filePath?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: "calls" | "imports" | "inherits" | "contains";
}

interface KnowledgeGraphProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

const defaultNodes: GraphNode[] = [
  { id: "app/main.py", label: "main.py", type: "module" },
  { id: "ArcheologyService", label: "ArcheologyService", type: "class", filePath: "app/services/archeology.py" },
  { id: "investigate", label: "investigate()", type: "function", filePath: "app/services/archeology.py" },
  { id: "ASTAnalyzer", label: "ASTAnalyzer", type: "class", filePath: "app/analyzer/ast.py" },
  { id: "extract_symbols", label: "extract_symbols()", type: "function", filePath: "app/analyzer/ast.py" },
  { id: "VectorSearchIndex", label: "VectorSearchIndex", type: "class", filePath: "app/search/vector.py" },
];

const defaultEdges: GraphEdge[] = [
  { id: "e1", source: "app/main.py", target: "ArcheologyService", relationship: "imports" },
  { id: "e2", source: "ArcheologyService", target: "investigate", relationship: "contains" },
  { id: "e3", source: "investigate", target: "ASTAnalyzer", relationship: "calls" },
  { id: "e4", source: "ASTAnalyzer", target: "extract_symbols", relationship: "contains" },
  { id: "e5", source: "investigate", target: "VectorSearchIndex", relationship: "calls" },
];

const NODE_COLORS: Record<string, string> = {
  module: "#3b82f6",     // blue
  class: "#8b5cf6",      // purple
  function: "#10b981",   // green
  variable: "#f59e0b",   // amber
};

export default function KnowledgeGraph({ nodes = defaultNodes, edges = defaultEdges }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!containerRef.current) return;

    const filteredNodes = filterType === "all" ? nodes : nodes.filter((n) => n.type === filterType);
    const validNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...filteredNodes.map((n) => ({
          data: { id: n.id, label: n.label, type: n.type, filePath: n.filePath || "" },
        })),
        ...filteredEdges.map((e) => ({
          data: { id: e.id, source: e.source, target: e.target, relationship: e.relationship },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": (ele: NodeSingular) => NODE_COLORS[ele.data("type")] || "#64748b",
            color: "#0f172a",
            "font-size": "12px",
            "font-weight": "bold",
            "text-valign": "bottom",
            "text-margin-y": 5,
            width: 32,
            height: 32,
            "border-width": 2,
            "border-color": "#ffffff",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#2563eb",
            width: 38,
            height: 38,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#cbd5e1",
            "target-arrow-color": "#cbd5e1",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(relationship)",
            "font-size": "9px",
            color: "#64748b",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
          },
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "TB",
        padding: 30,
      } as unknown as cytoscape.LayoutOptions,
    });

    cy.on("tap", "node", (evt) => {
      const nodeData = evt.target.data();
      setSelectedNode({
        id: nodeData.id,
        label: nodeData.label,
        type: nodeData.type,
        filePath: nodeData.filePath,
      });
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [nodes, edges, filterType]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800">Knowledge Graph</h3>
          <span className="text-xs text-slate-500">({nodes.length} symbols, {edges.length} links)</span>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 font-medium">Filter:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="module">Modules</option>
            <option value="class">Classes</option>
            <option value="function">Functions</option>
          </select>

          <div className="flex items-center gap-1 ml-2">
            <button onClick={handleZoomIn} className="px-2 py-1 bg-slate-100 text-xs rounded hover:bg-slate-200 font-mono">+</button>
            <button onClick={handleZoomOut} className="px-2 py-1 bg-slate-100 text-xs rounded hover:bg-slate-200 font-mono">-</button>
            <button onClick={handleFit} className="px-2 py-1 bg-slate-100 text-xs rounded hover:bg-slate-200">Fit</button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative w-full h-[450px] bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
        <div ref={containerRef} className="w-full h-full" />

        {/* Sidebar Info Drawer */}
        {selectedNode && (
          <div className="absolute top-3 right-3 w-64 bg-white/95 backdrop-blur p-4 rounded-lg shadow-lg border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <span className="font-semibold text-slate-800 text-sm">{selectedNode.label}</span>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="space-y-1 text-slate-600">
              <p><strong className="text-slate-700">Type:</strong> <span className="capitalize">{selectedNode.type}</span></p>
              {selectedNode.filePath && (
                <p className="font-mono text-[11px] text-blue-600 truncate"><strong className="text-slate-700">File:</strong> {selectedNode.filePath}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span className="font-medium">Legend:</span>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Module</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Class</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Function</div>
      </div>
    </div>
  );
}
