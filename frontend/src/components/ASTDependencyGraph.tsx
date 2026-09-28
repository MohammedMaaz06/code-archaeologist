"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";

export default function ASTDependencyGraph() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchGraphData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await api.exportGraph();

        if (cancelled) return;

        const flowNodes: Node[] = data.nodes.map((node, index) => ({
          id: node.id,
          data: {
            label: node.label || node.id,
          },
          position: {
            x: (index % 4) * 220,
            y: Math.floor(index / 4) * 140,
          },
        }));

        const flowEdges: Edge[] = data.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.relationship,
          animated: edge.relationship === "calls",
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load dependency graph:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load dependency graph"
          );
          setNodes([]);
          setEdges([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGraphData();

    return () => {
      cancelled = true;
    };
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <span>???</span> AST & Module Dependency Flow
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive graph generated from the backend code knowledge graph.
          </p>
        </div>

        <span className="text-xs font-mono bg-indigo-950 border border-indigo-800 text-indigo-300 px-2.5 py-1 rounded-md">
          {nodes.length} Nodes / {edges.length} Edges
        </span>
      </div>

      <div className="w-full h-[400px] bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-blue-400 font-mono animate-pulse">
            Loading dependency graph...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-sm text-rose-400 font-semibold">
              Unable to load dependency graph
            </p>
            <p className="text-xs text-slate-500 mt-2 max-w-lg">
              {error}
            </p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-sm text-slate-300 font-semibold">
              No graph data available
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Run a repository scan to generate the code knowledge graph.
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
          >
            <Background color="#334155" gap={16} />
            <Controls className="bg-slate-900 border border-slate-800 text-slate-200 fill-slate-200" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
