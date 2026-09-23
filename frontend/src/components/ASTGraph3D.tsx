"use client";

import React, { useEffect, useState } from "react";

interface NodeData {
  id: string;
  node_type?: string;
  label?: string;
}

interface EdgeData {
  source: string;
  target: string;
  relation?: string;
}

export default function ASTGraph3D() {
  const [graphData, setGraphData] = useState<{ nodes: NodeData[]; edges: EdgeData[] }>({
    nodes: [],
    edges: [],
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [blastRadius, setBlastRadius] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/v1/graph/export")
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load graph data:", err);
        setLoading(false);
      });
  }, []);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    fetch(`http://localhost:8000/api/v1/graph/blast-radius?symbol_id=${encodeURIComponent(nodeId)}`)
      .then((res) => res.json())
      .then((data) => setBlastRadius(data))
      .catch((err) => console.error("Error fetching blast radius:", err));
  };

  if (loading) {
    return <div className="p-4 text-slate-400">Loading Code Knowledge Graph...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4 text-cyan-400">Code Knowledge Graph & Blast Radius Explorer</h2>
      
      <div className="grid grid-cols-3 gap-4 h-[500px]">
        {/* Graph Node List / Visual Canvas */}
        <div className="col-span-2 border border-slate-700 bg-slate-950 p-4 rounded overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2 text-slate-400">Indexed Graph Nodes ({graphData.nodes.length})</h3>
          <ul className="space-y-1">
            {graphData.nodes.map((node) => (
              <li
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center transition-colors ${
                  selectedNode === node.id ? "bg-cyan-900 border border-cyan-500" : "hover:bg-slate-800"
                }`}
              >
                <span className="font-mono text-xs truncate max-w-[300px]">{node.id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                  {node.node_type || "Node"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Selected Node Blast Radius Side Panel */}
        <div className="border border-slate-700 bg-slate-950 p-4 rounded overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2 text-slate-400">Blast Radius Analysis</h3>
          {selectedNode ? (
            <div>
              <p className="text-xs font-mono text-cyan-300 break-all mb-3">{selectedNode}</p>
              {blastRadius ? (
                <div className="space-y-3">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Impacted Symbols</span>
                    <span className="text-lg font-bold text-rose-400">{blastRadius.total_impacted}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Affected Downstream / Upstream Nodes:</span>
                    <ul className="space-y-1">
                      {blastRadius.affected_nodes?.map((affected: string) => (
                        <li key={affected} className="text-xs font-mono bg-slate-900 p-1 rounded text-slate-300 break-all">
                          {affected}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Calculating impact...</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Click a node on the left to calculate its change blast radius.</p>
          )}
        </div>
      </div>
    </div>
  );
}