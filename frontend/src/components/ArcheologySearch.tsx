"use client";

import React, { useState } from "react";
import { api, MatchedChunk } from "@/lib/api";

function CodeViewer({ code, filePath }: { code: string; filePath: string }) {
  const lines = code.split("\n");

  // Determine file language extension
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  // Basic syntax highlighters for common keywords
  const highlightLine = (line: string) => {
    // Escape HTML characters
    let formatted = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Highlight comments
    if (formatted.trim().startsWith("//") || formatted.trim().startsWith("#")) {
      return <span className="text-slate-500 italic">{formatted}</span>;
    }

    // Highlight strings
    formatted = formatted.replace(
      /(["'])(?:(?=(\\?))\2[\s\S])*?\1/g,
      '<span class="text-amber-300">$&</span>'
    );

    // Highlight keywords (Python / TS / JS)
    const keywords = [
      "def", "class", "import", "from", "return", "const", "let", "var",
      "function", "async", "await", "if", "else", "for", "while", "try",
      "except", "catch", "raise", "export", "interface", "type", "public", "private"
    ];
    const kwRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
    formatted = formatted.replace(kwRegex, '<span class="text-purple-400 font-semibold">$1</span>');

    // Highlight built-in functions / types
    const types = ["str", "int", "float", "bool", "dict", "list", "Promise", "string", "number", "boolean", "any", "void"];
    const typeRegex = new RegExp(`\\b(${types.join("|")})\\b`, "g");
    formatted = formatted.replace(typeRegex, '<span class="text-cyan-400">$1</span>');

    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto font-mono text-xs shadow-inner">
      <table className="w-full text-left border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
              <td className="w-10 select-none text-right pr-3 py-0.5 text-slate-600 border-r border-slate-800/80 font-mono text-[11px]">
                {idx + 1}
              </td>
              <td className="pl-4 pr-3 py-0.5 whitespace-pre text-slate-200">
                {highlightLine(line)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ArcheologySearch() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<MatchedChunk[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setExplanation(null);

    try {
      // Execute vector investigation and LLM explanation simultaneously
      const [investigateRes, explainRes] = await Promise.all([
        api.investigate(query, topK),
        api.explain(query, topK).catch(() => null),
      ]);

      setResults(investigateRes.matched_chunks || []);
      if (explainRes) {
        setExplanation(explainRes.explanation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search query failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-6 space-y-6">
      <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>🔍</span> Vector Archeology Search
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Retrieve semantically similar source code chunks and LLM synthesis across vector indices.
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Find function where vector embeddings are created or graph endpoints"
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          >
            <option value={3}>Top 3</option>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 text-xs rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Searching...
              </>
            ) : (
              "Query Archeology"
            )}
          </button>
        </div>
      </form>

      {/* Error View */}
      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-lg">
          <strong>Search Error:</strong> {error}
        </div>
      )}

      {/* LLM Synthesis Explanation Card */}
      {explanation && (
        <div className="bg-slate-850 border border-slate-700/60 bg-slate-800/40 rounded-xl p-4 space-y-2">
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <span>✨</span> AI Synthesis Explanation
          </div>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{explanation}</p>
        </div>
      )}

      {/* Results List */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Found <strong>{results.length}</strong> matching source code chunks</span>
          </div>

          <div className="space-y-4">
            {results.map((chunk, index) => (
              <div
                key={index}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-800/50 px-2.5 py-1 rounded">
                    {chunk.file_path}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                    Score: {(chunk.score * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Code Snippet with Line Numbers and Highlighting */}
                <CodeViewer code={chunk.source_code} filePath={chunk.file_path} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
