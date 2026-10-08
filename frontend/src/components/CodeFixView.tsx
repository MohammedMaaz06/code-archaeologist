"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";
import { Panel } from "@/components/ui";
import { api, type CodeFixResult } from "@/lib/api";

const fieldClass =
  "w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-600";

const codeClass =
  "min-h-[220px] w-full overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap";

export default function CodeFixView() {
  const [repoPath, setRepoPath] = useState("");
  const [filePath, setFilePath] = useState("");
  const [language, setLanguage] = useState("python");
  const [issue, setIssue] = useState("");
  const [sourceCode, setSourceCode] = useState("");

  const [result, setResult] = useState<CodeFixResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generateFix = async () => {
    const trimmedIssue = issue.trim();
    const trimmedSource = sourceCode.trim();
    const trimmedRepo = repoPath.trim();
    const trimmedFile = filePath.trim();
    const trimmedLanguage = language.trim();

    setError("");
    setResult(null);

    if (!trimmedIssue) {
      setError("Describe the issue you want the AI to fix.");
      return;
    }

    if (!trimmedSource && (!trimmedRepo || !trimmedFile)) {
      setError("Provide source code, or provide both repository path and file path.");
      return;
    }

    setLoading(true);

    const controller = new AbortController();

    try {
      const response = await api.codeFix(
        {
          issue: trimmedIssue,
          source_code: trimmedSource || undefined,
          repo_path: trimmedRepo || undefined,
          file_path: trimmedFile || undefined,
          language: trimmedLanguage || undefined,
        },
        controller.signal
      );

      setResult(response);

      if (response.status === "unavailable") {
        setError("The AI model did not return a correction. Check Ollama and the backend logs.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code Fix request failed.");
    } finally {
      setLoading(false);
    }
  };

  const statusIcon =
    result?.validation_status === "passed" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : result?.validation_status === "failed" ? (
      <XCircle className="h-4 w-4 text-rose-500" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    );

  return (
    <div className="space-y-4">
      <Panel
        title="AI Code Fix"
        subtitle="Generate a reviewable correction from source code or a repository file. Changes are never applied automatically."
        actions={
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Wrench className="h-3.5 w-3.5" />
            <span>POST /code-fix</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Repository path
              </label>
              <input
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="C:\path\to\repository"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                File path
              </label>
              <input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="backend/app/example.py"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Language
              </label>
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="python"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Issue
              </label>
              <textarea
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Example: this function subtracts values but it should add them."
                rows={5}
                className={`${fieldClass} resize-y`}
              />
            </div>

            <button
              type="button"
              onClick={generateFix}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-sky-700 bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-200 transition-colors hover:border-sky-600 hover:bg-sky-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
              {loading ? "Generating correction..." : "Generate correction"}
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Source code
            </label>
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="Paste source code here, or leave empty to read the file from repository path + file path."
              rows={28}
              className={`${fieldClass} resize-y font-mono leading-relaxed`}
            />
          </div>
        </div>
      </Panel>

      {error && (
        <div className="rounded-md border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {result && (
        <>
          <Panel
            title="Fix Result"
            subtitle={result.file_path ? `Repository file: ${result.file_path}` : "Generated from supplied source code"}
          >
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
              <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Status</p>
                <p className="mt-1 text-xs font-semibold text-slate-200">{result.status}</p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Validation</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  {statusIcon}
                  <span>{result.validation_status ?? "unknown"}</span>
                </div>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Model</p>
                <p className="mt-1 truncate font-mono text-xs text-slate-200">{result.model ?? "unknown"}</p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Changed</p>
                <p className="mt-1 text-xs font-semibold text-slate-200">
                  {result.changed ? "Yes" : "No"}
                </p>
              </div>
            </div>

            {result.validation_message && (
              <div className="mx-4 mb-4 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                {result.validation_message}
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Original code">
              <div className="p-4">
                <pre className={codeClass}>{result.original_code || "No original code returned."}</pre>
              </div>
            </Panel>

            <Panel title="Corrected code">
              <div className="p-4">
                <pre className={codeClass}>{result.corrected_code || "No corrected code returned."}</pre>
              </div>
            </Panel>
          </div>

          <Panel
            title="Unified diff"
            subtitle="Review the exact generated change before considering any manual application."
          >
            <div className="p-4">
              <pre className={codeClass}>{result.diff || "No diff generated."}</pre>
            </div>
          </Panel>

          {result.impact_analysis && (
            <Panel title="Impact analysis context">
              <div className="p-4">
                <pre className={codeClass}>
                  {JSON.stringify(result.impact_analysis, null, 2)}
                </pre>
              </div>
            </Panel>
          )}

          {result.original_sha256 && (
            <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-500">
              Original file SHA-256: <span className="font-mono text-slate-400">{result.original_sha256}</span>
            </div>
          )}

          <div className="rounded-md border border-amber-900/50 bg-amber-950/15 px-3 py-2 text-[10px] text-amber-300">
            This workflow only generates and displays a proposed correction. It does not modify the repository.
          </div>
        </>
      )}
    </div>
  );
}
