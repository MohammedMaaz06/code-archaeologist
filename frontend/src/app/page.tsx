"use client";

import React, { useState } from "react";
import SymbolSearchAST from "@/components/SymbolSearchAST";
import CodeExplanationPanel from "@/components/CodeExplanationPanel";
import ASTDependencyGraph from "@/components/ASTDependencyGraph";

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState("parse_ast_tree");
  const [selectedSnippet, setSelectedSnippet] = useState(
    `def parse_ast_tree(file_content: str) -> List[Dict[str, Any]]:\n    """Parses source code into AST hierarchy nodes."""\n    tree = ast.parse(file_content)\n    return ASTVisitor().visit(tree)`
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>🏛️</span> Code Archaeologist
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            AST Exploration, Local Ollama AI Code Analysis, and Module Dependency Topology.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-950 border border-emerald-800 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Local Stack Active
          </span>
        </div>
      </header>

      {/* Grid Layout: Top Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Symbol Search & AST Explorer */}
        <SymbolSearchAST />

        {/* AI Code Explanation Panel */}
        <CodeExplanationPanel
          selectedSymbolName={selectedSymbol}
          codeSnippet={selectedSnippet}
        />
      </div>

      {/* Grid Layout: Bottom Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* AST Dependency Flow Graph */}
        <ASTDependencyGraph />
      </div>
    </main>
  );
}
