"use client";

import { useState } from "react";
import { api, InvestigationResult, ExplanationResponse } from "@/lib/api";

export default function ArcheologySearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const [invData, expData] = await Promise.all([
        api.investigate(query),
        api.explain(query),
      ]);

      setInvestigation(invData);
      setExplanation(expData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about the codebase..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Investigate"}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {explanation && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <h3 className="text-lg font-semibold text-slate-800">Archeology Explanation</h3>
          <p className="text-slate-600 whitespace-pre-wrap">{explanation.explanation}</p>
        </div>
      )}

      {investigation && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">
            Matched Chunks ({investigation.matched_chunks.length})
          </h3>
          <div className="space-y-3">
            {investigation.matched_chunks.map((chunk, idx) => (
              <div key={idx} className="p-4 border rounded-lg bg-white shadow-sm space-y-2">
                <div className="flex justify-between items-center text-sm text-slate-500">
                  <span className="font-mono text-blue-600">{chunk.file_path}</span>
                  <span>Score: {chunk.score.toFixed(3)}</span>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded text-xs overflow-x-auto">
                  <code>{chunk.source_code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
