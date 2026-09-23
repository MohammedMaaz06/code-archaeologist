"use client";

import React, { useState } from "react";

export default function SymbolSearchAST() {
  const [query, setQuery] = useState("");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
          <span>🔍</span> Symbol & AST Search
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Search across indexed codebase AST symbols.</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search symbol (e.g., parse_ast_tree)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
        />
        <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors">
          Search
        </button>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 min-h-[120px] text-xs text-slate-500 flex items-center justify-center">
        Enter a query above to inspect AST hierarchy nodes.
      </div>
    </div>
  );
}