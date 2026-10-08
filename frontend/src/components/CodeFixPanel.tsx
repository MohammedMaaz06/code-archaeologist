import React, { useState } from "react";
import { api, CodeFixResult } from "@/lib/api";

export default function CodeFixPanel() {
  const [repoPath, setRepoPath] = useState("");
  const [filePath, setFilePath] = useState("");
  const [issue, setIssue] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [language, setLanguage] = useState("");
  const [result, setResult] = useState<CodeFixResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateFix = async () => {
    setError("");
    setResult(null);

    if (!issue.trim()) {
      setError("Describe the issue before generating a fix.");
      return;
    }

    if (!sourceCode.trim() && (!repoPath.trim() || !filePath.trim())) {
      setError("Provide source code or provide both repository path and file path.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.codeFix({
        issue: issue.trim(),
        source_code: sourceCode.trim() || undefined,
        repo_path: repoPath.trim() || undefined,
        file_path: filePath.trim() || undefined,
        language: language.trim() || undefined,
      });

      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code fix.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-6 shadow-xl">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-100">
          AI Code Fix
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Generate an evidence-backed correction without automatically changing your files.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Repository Path
          </label>
          <input
            value={repoPath}
            onChange={(event) => setRepoPath(event.target.value)}
            placeholder="C:\path\to\repository"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            File Path
          </label>
          <input
            value={filePath}
            onChange={(event) => setFilePath(event.target.value)}
            placeholder="backend/app/example.py"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Language
          </label>
          <input
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="python"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Issue
          </label>
          <input
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
            placeholder="Explain the bug or problem..."
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Source Code
        </label>
        <textarea
          value={sourceCode}
          onChange={(event) => setSourceCode(event.target.value)}
          placeholder="Paste source code here, or leave empty when using repository + file path."
          rows={12}
          className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm font-mono text-slate-100 outline-none focus:border-indigo-500 resize-y"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-5">
        <button
          onClick={generateFix}
          disabled={loading}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all"
        >
          {loading ? "Generating Fix..." : "Generate AI Fix"}
        </button>
      </div>

      {result && (
        <div className="mt-8 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300">
              Status: {result.status}
            </span>

            {result.validation_status && (
              <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300">
                Validation: {result.validation_status}
              </span>
            )}

            {result.model && (
              <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300">
                Model: {result.model}
              </span>
            )}
          </div>

          {result.validation_message && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              {result.validation_message}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-2">
                Original Code
              </h3>
              <pre className="min-h-48 max-h-[32rem] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 whitespace-pre-wrap">
                {result.original_code || "No original code returned."}
              </pre>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-2">
                Corrected Code
              </h3>
              <pre className="min-h-48 max-h-[32rem] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 whitespace-pre-wrap">
                {result.corrected_code || "No corrected code returned."}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Unified Diff
            </h3>
            <pre className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 whitespace-pre-wrap">
              {result.diff || "No changes were generated."}
            </pre>
          </div>

          {result.impact_analysis && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-2">
                Impact Analysis Context
              </h3>
              <pre className="max-h-80 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(result.impact_analysis, null, 2)}
              </pre>
            </div>
          )}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
            Review the generated correction and diff carefully. This panel does not automatically modify the repository.
          </div>
        </div>
      )}
    </section>
  );
}
