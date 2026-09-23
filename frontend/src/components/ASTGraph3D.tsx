"use client";

import React, { useState, useRef } from "react";
import dynamic from "next/dynamic";

// Dynamically import ForceGraph3D to prevent WebGL SSR window issues
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export default function ASTGraph3D() {
  const fgRef = useRef<any>(null);
  const [graphData] = useState({
    nodes: [
      { id: "main.py", name: "main.py (FastAPI Root)", group: 1, val: 20 },
      { id: "api_ast.py", name: "api_ast.py (AST Endpoints)", group: 2, val: 12 },
      { id: "api_explain.py", name: "api_explain.py (Ollama Prompting)", group: 2, val: 12 },
      { id: "api_graph.py", name: "api_graph.py (Graph Engine)", group: 2, val: 12 },
      { id: "indexer.py", name: "indexer.py (AST Extractor)", group: 3, val: 15 },
      { id: "ollama.service", name: "Ollama LLM Engine", group: 4, val: 18 },
    ],
    links: [
      { source: "main.py", target: "api_ast.py" },
      { source: "main.py", target: "api_explain.py" },
      { source: "main.py", target: "api_graph.py" },
      { source: "api_ast.py", target: "indexer.py" },
      { source: "api_explain.py", target: "ollama.service" },
    ],
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
            <span>🌐</span> 3D Interactive AST & Module Topology
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Drag to rotate in 3D • Scroll to zoom • Hover or click nodes to inspect dependencies.
          </p>
        </div>
        <span className="text-xs font-mono bg-indigo-950 border border-indigo-700 text-indigo-300 px-3 py-1 rounded-full">
          WebGL 3D Mode
        </span>
      </div>

      <div className="w-full h-[450px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 relative">
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          nodeLabel="name"
          nodeAutoColorBy="group"
          linkDirectionalParticles={4}
          linkDirectionalParticleSpeed={0.008}
          linkDirectionalParticleWidth={2}
          nodeRelSize={7}
          backgroundColor="#020617"
          showNavInfo={false}
        />
      </div>
    </div>
  );
}