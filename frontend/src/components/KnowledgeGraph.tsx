"use client";

import React, { useEffect, useRef, useState } from "react";
import cytoscape, { Core } from "cytoscape";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  filePath?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

interface KnowledgeGraphProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

export default function KnowledgeGraph({ nodes = [], edges = [] }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const elements = [
      ...nodes.map((n) => ({
        data: { id: n.id, label: n.label, type: n.type, filePath: n.filePath },
      })),
      ...edges.map((e, idx) => ({
        data: {
          id: `edge-${idx}`,
          source: e.source,
          target: e.target,
          label: e.relation,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#3b82f6",
            label: "data(label)",
            color: "#f8fafc",
            "font-size": "10px",
            "text-valign": "bottom",
            "text-margin-y": 4,
            width: 24,
            height: 24,
          },
        },
        {
          selector: 'node[type = "file"]',
          style: { "background-color": "#10b981", width: 28, height: 28 },
        },
        {
          selector: 'node[type = "function"]',
          style: { "background-color": "#6366f1" },
        },
        {
          selector: 'node[type = "class"]',
          style: { "background-color": "#f59e0b" },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#475569",
            "target-arrow-color": "#475569",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            color: "#64748b",
            "font-size": "8px",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
      },
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

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [nodes, edges]);

  const exportPNG = () => {
    if (!cyRef.current) return;
    const pngBase64 = cyRef.current.png({ bg: "#0f172a", full: true, scale: 2 });
    const link = document.createElement("a");
    link.href = pngBase64;
    link.download = `knowledge-graph-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (!cyRef.current) return;
    const graphData = {
      nodes,
      edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `knowledge-graph-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <span>🕸️</span> Codebase Architecture Knowledge Graph
          </h3>
          <p className="text-xs text-slate-400">Visual AST & Symbol Dependency Topology</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportPNG}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <span>📷</span> Export PNG
          </button>
          <button
            onClick={exportJSON}
            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <span>💾</span> Export JSON
          </button>
        </div>
      </div>

      <div className="relative">
        <div ref={containerRef} className="w-full h-[450px] bg-slate-950 rounded-lg border border-slate-800/80" />

        {selectedNode && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 shadow-lg backdrop-blur-sm max-w-xs space-y-1">
            <div className="font-bold text-blue-400 border-b border-slate-800 pb-1 mb-1 flex justify-between items-center">
              <span>Node Inspector</span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <div><strong>ID:</strong> {selectedNode.id}</div>
            <div><strong>Type:</strong> <span className="uppercase text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{selectedNode.type}</span></div>
            {selectedNode.filePath && (
              <div className="truncate"><strong>Path:</strong> <span className="font-mono text-slate-400">{selectedNode.filePath}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
