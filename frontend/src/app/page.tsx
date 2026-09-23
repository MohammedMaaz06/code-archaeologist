"use client";

import React, { useState } from "react";
import SymbolSearchAST from "@/components/SymbolSearchAST";
import CodeExplanationPanel from "@/components/CodeExplanationPanel";
import ASTDependencyGraph from "@/components/ASTDependencyGraph";
import ASTGraph3D from "@/components/ASTGraph3D";

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState("parse_ast_tree");

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8 font-sans">
      <header className="border-b border-slate-800 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>🏛️</span> Code Archaeologist Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            AST Exploration, Local Ollama AI Code Analysis, and 3D Dependency Topology.
          </p>
        </div>
        <span className="text-xs font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 px-3 py-1 rounded-full">
          ● Local Stack Active
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SymbolSearchAST />
        <CodeExplanationPanel selectedSymbolName={selectedSymbol} />
      </div>

      <div className="space-y-6">
        <ASTGraph3D />
        <ASTDependencyGraph />
      </div>
    </main>
  );
}