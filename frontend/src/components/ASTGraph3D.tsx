"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  const [blastRadiusLoading, setBlastRadiusLoading] = useState<boolean>(false);
  const [blastRadiusError, setBlastRadiusError] = useState<string | null>(null);
  const [blastRadiusDepth, setBlastRadiusDepth] = useState<number>(3);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadGraph = () => {
    setLoading(true);
    setGraphError(null);

    api.exportGraph()
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load graph data:", err);
        setGraphError("Failed to load the code knowledge graph.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const analyzeBlastRadius = (nodeId: string, depth: number) => {
    setBlastRadius(null);
    setBlastRadiusError(null);
    setBlastRadiusLoading(true);

    api.getBlastRadius(nodeId, depth)
      .then((data) => setBlastRadius(data))
      .catch((err) => {
        console.error("Error fetching blast radius:", err);
        setBlastRadiusError("Failed to calculate blast radius.");
      })
      .finally(() => setBlastRadiusLoading(false));
  };

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    analyzeBlastRadius(nodeId, blastRadiusDepth);
  };

  const handleBlastRadiusDepthChange = (depth: number) => {
    setBlastRadiusDepth(depth);

    if (selectedNode) {
      analyzeBlastRadius(selectedNode, depth);
    }
  };

  if (loading) {
    return <div className="p-4 text-slate-400">Loading Code Knowledge Graph...</div>;
  }

  if (graphError) {
    return (
      <div className="p-4 rounded-lg border border-rose-900 bg-slate-900 text-rose-400">
        <p className="text-sm font-semibold">Unable to load graph</p>
        <p className="text-xs text-slate-500 mt-1">{graphError}</p>
        <button
          onClick={loadGraph}
          className="mt-3 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4 text-cyan-400">Code Knowledge Graph & Blast Radius Explorer</h2>
      
      <div className="grid grid-cols-3 gap-4 h-[500px]">
        {/* Graph Node List / Visual Canvas */}
        <div className="col-span-2 border border-slate-700 bg-slate-950 p-4 rounded overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2 text-slate-400">Indexed Graph Nodes ({graphData.nodes.length})</h3>
          <ul className="space-y-1">
            {graphData.nodes.length === 0 ? (
              <li className="rounded border border-slate-800 bg-slate-900 p-4 text-center">
                <p className="text-sm text-slate-400">No indexed graph nodes found.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Scan a repository to build the code knowledge graph.
                </p>
              </li>
            ) : (
              graphData.nodes.map((node) => (
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
              ))
            )}
          </ul>
        </div>

        {/* Selected Node Blast Radius Side Panel */}
        <div className="border border-slate-700 bg-slate-950 p-4 rounded overflow-y-auto">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-sm font-semibold text-slate-400">Blast Radius Analysis</h3>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Depth
              <select
                value={blastRadiusDepth}
                onChange={(event) => handleBlastRadiusDepthChange(Number(event.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map((depth) => (
                  <option key={depth} value={depth}>
                    {depth}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedNode ? (
            <div>
              <p className="text-xs font-mono text-cyan-300 break-all mb-3">{selectedNode}</p>
              {blastRadiusLoading ? (
                <p className="text-xs text-slate-500">Calculating impact...</p>
              ) : blastRadiusError ? (
                <p className="text-xs text-rose-400">{blastRadiusError}</p>
              ) : blastRadius ? (
                <div className="space-y-3">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Impacted Symbols</span>
                    <span className="text-lg font-bold text-rose-400">{blastRadius.total_impacted}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Affected Downstream / Upstream Nodes</span>
                      <span className="text-xs text-slate-500">
                        {blastRadius.affected_nodes?.length ?? 0}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {blastRadius.affected_nodes?.map((affected: string, index: number) => (
                        <li
                          key={affected}
                          className="text-xs bg-slate-900 p-2 rounded border border-slate-800 flex items-start gap-2"
                        >
                          <span className="text-slate-500 font-mono min-w-5">
                            {index + 1}.
                          </span>
                          <span className="font-mono text-slate-300 break-all">
                            {affected}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select a node to calculate its blast radius.</p>
              )}</div>
          ) : (
            <p className="text-xs text-slate-500">Click a node on the left to calculate its change blast radius.</p>
          )}
        </div>
      </div>
    </div>
  );
}