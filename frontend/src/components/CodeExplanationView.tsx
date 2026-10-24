"use client";

import React, { useState } from "react";
import { BookOpenText, Loader2, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui";
import { api, type ExplanationResponse } from "@/lib/api";

const fieldClass =
  "w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-600";

const suggestions = [
  "Explain the main architecture of this repository.",
  "How do the main modules depend on each other?",
  "Explain the purpose of the key functions and classes.",
];

export default function CodeExplanationView({
  repositoryPath,
  repositoryName,
}: {
  repositoryPath?: string;
  repositoryName?: string;
}) {
  const [query, setQuery] = useState(suggestions[0]);
  const [result, setResult] = useState<ExplanationResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const explainCode = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const prompt = query.trim();

    if (!prompt) {
      setError("Enter a question about the repository first.");
      setResult(null);
      return;
    }
    if (!repositoryPath) {
      setError("Scan a repository before asking for an explanation.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.explain(prompt, 5, repositoryPath);
      if (!response.explanation?.trim()) {
        setError("The service did not return an explanation. Check the backend logs and try again.");
      } else {
        setResult(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not explain this code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Code Explanation"
        subtitle={
          repositoryName
            ? `Ask about ${repositoryName}'s architecture, modules, functions, and dependencies.`
            : "Scan a repository before asking questions about its architecture, modules, functions, and dependencies."
        }
        actions={
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <BookOpenText className="h-3.5 w-3.5" />
            <span>Repository-aware answers</span>
          </div>
        }
      >
        <form onSubmit={explainCode} className="space-y-4 p-4">
          <div>
            <label htmlFor="code-explanation-question" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              What do you want to understand?
            </label>
            <textarea
              id="code-explanation-question"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Example: Explain how the API request flows through the main modules."
              rows={4}
              className={`${fieldClass} resize-y leading-relaxed`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="rounded-md border border-slate-800 px-2.5 py-1.5 text-left text-[11px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Explaining repositoryâ€¦" : "Explain code"}
          </button>
        </form>
      </Panel>

      {error && (
        <div role="alert" className="rounded-md border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {result && (
        <Panel title="Explanation" subtitle={`Question: ${result.query || query.trim()}`}>
          <div className="whitespace-pre-wrap break-words p-4 text-sm leading-7 text-slate-300">
            {result.explanation}
          </div>
          <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
            Review explanations against the source code before using them to make changes.
          </div>
        </Panel>
      )}
    </div>
  );
}
