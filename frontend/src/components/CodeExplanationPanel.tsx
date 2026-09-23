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

  const generateExplanation = (mode: "summary" | "complexity" | "security") => {
    setActiveTab(mode);
    setLoading(true);

    setTimeout(() => {
      if (mode === "summary") {
        setExplanation(
          `**Functional Role:**\nThis method accepts raw source code and converts it into a structural Abstract Syntax Tree (AST).\n\n**Key Actions:**\n1. Invokes Python's native \`ast.parse\` module.\n2. Traverses nodes via custom \`ASTVisitor\`.\n3. Extracts classes, methods, and functions into a standardized dictionary list.`
        );
      } else if (mode === "complexity") {
        setExplanation(
          `**Time Complexity:** O(N) where N is the number of tokens in the source file.\n**Space Complexity:** O(D) where D is the maximum depth of the AST call stack.\n\n**Maintainability Index:** High (88/100). Standard AST traversal with negligible overhead.`
        );
      } else {
        setExplanation(
          `**Security Audit:**\n• **AST Parsing:** Safe — parsing source code statically without invoking \`exec()\` or \`eval()\`. \n• **Input Validation:** Ensure file size limits are enforced to avoid AST ReDoS / stack overflow on malformed files.`
        );
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <span>💡</span> AI Code Explanation Panel
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Deep contextual explanations, complexity analysis, and security audits for selected symbols.
          </p>
        </div>
        <span className="text-xs font-mono bg-blue-950 border border-blue-800 text-blue-300 px-2.5 py-1 rounded-md">
          Symbol: {selectedSymbolName}
        </span>
      </div>

      {/* Code Snippet Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
        <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold">
          Target Code Snippet
        </span>
        <pre className="mt-1 font-mono text-xs text-emerald-400 overflow-x-auto p-2 bg-slate-900/80 rounded border border-slate-800/80">
          {codeSnippet}
        </pre>
      </div>

      {/* Action Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => generateExplanation("summary")}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            activeTab === "summary"
              ? "bg-blue-600/20 border-blue-500 text-blue-300"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
          }`}
        >
          📝 AI Overview
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

      {/* Explanation Result Output */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 min-h-[140px] text-xs font-mono text-slate-300">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-blue-400 animate-pulse gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-ping" /> Analyzing code context...
          </div>
        ) : explanation ? (
          <div className="whitespace-pre-line leading-relaxed">{explanation}</div>
        ) : (
          <div className="text-slate-500 text-center py-8">
            Click any button above to generate AI code analysis.
          </div>
        )}
      </div>
    </div>
  );
}
