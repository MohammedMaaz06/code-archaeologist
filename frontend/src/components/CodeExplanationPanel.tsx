"use client";

import React, { useState } from "react";

interface CodeExplanationPanelProps {
  selectedSymbolName?: string;
  codeSnippet?: string;
}

export default function CodeExplanationPanel({
  selectedSymbolName = "parse_ast_tree",
  codeSnippet = `def parse_ast_tree(file_content: str) -> List[Dict[str, Any]]:\n    """Parses source code into AST hierarchy nodes."""\n    tree = ast.parse(file_content)\n    return ASTVisitor().visit(tree)`,
}: CodeExplanationPanelProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "complexity" | "security">("summary");
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const generateExplanation = async (mode: "summary" | "complexity" | "security") => {
    setActiveTab(mode);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol_name: selectedSymbolName,
          code_snippet: codeSnippet,
          mode: mode,
        }),
      });

      const data = await res.json();
      setExplanation(data.explanation || "No output returned.");
      if (data.model) setUsedModel(data.model);
    } catch (err: any) {
      setExplanation(`❌ Failed to connect to backend: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <span>🦙</span> Local Ollama AI Code Explanation Panel
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Powered by local LLM models via Ollama.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {usedModel && (
            <span className="text-[10px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded">
              Model: {usedModel}
            </span>
          )}
          <span className="text-xs font-mono bg-blue-950 border border-blue-800 text-blue-300 px-2.5 py-1 rounded-md">
            Symbol: {selectedSymbolName}
          </span>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
        <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold">
          Target Code Snippet
        </span>
        <pre className="mt-1 font-mono text-xs text-emerald-400 overflow-x-auto p-2 bg-slate-900/80 rounded border border-slate-800/80">
          {codeSnippet}
        </pre>
      </div>

      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => generateExplanation("summary")}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            activeTab === "summary"
              ? "bg-blue-600/20 border-blue-500 text-blue-300"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
          }`}
        >
          📝 Ollama Overview
        </button>
        <button
          onClick={() => generateExplanation("complexity")}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            activeTab === "complexity"
              ? "bg-purple-600/20 border-purple-500 text-purple-300"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
          }`}
        >
          ⚡ Complexity (Big-O)
        </button>
        <button
          onClick={() => generateExplanation("security")}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            activeTab === "security"
              ? "bg-rose-600/20 border-rose-500 text-rose-300"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
          }`}
        >
          🛡️ Security Check
        </button>
      </div>

      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 min-h-[140px] text-xs font-mono text-slate-300">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-blue-400 animate-pulse gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-ping" /> Generating with Ollama local model...
          </div>
        ) : explanation ? (
          <div className="whitespace-pre-line leading-relaxed">{explanation}</div>
        ) : (
          <div className="text-slate-500 text-center py-8">
            Click any button above to run inference through your local Ollama model.
          </div>
        )}
      </div>
    </div>
  );
}