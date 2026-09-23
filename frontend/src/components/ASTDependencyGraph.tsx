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

export default function ASTDependencyGraph() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/graph`);
        const data = await res.json();
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      } catch (err) {
        console.warn("Failed to fetch graph data, using default topology:", err);
        setNodes([
          { id: "1", data: { label: "main.py" }, position: { x: 250, y: 20 } },
          { id: "2", data: { label: "api_ast.py" }, position: { x: 100, y: 130 } },
          { id: "3", data: { label: "api_explain.py" }, position: { x: 400, y: 130 } },
          { id: "4", data: { label: "Ollama (LLM)" }, position: { x: 400, y: 250 } },
        ]);
        setEdges([
          { id: "e1-2", source: "1", target: "2", animated: true },
          { id: "e1-3", source: "1", target: "3", animated: true },
          { id: "e3-4", source: "3", target: "4", animated: true },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, [API_URL]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <span>🕸️</span> AST & Module Dependency Flow
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive node graph illustrating structural imports and execution pathways.
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
