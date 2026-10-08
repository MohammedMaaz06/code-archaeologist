"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderGit2, Loader2 } from "lucide-react";
import {
  api,
  isAbortError,
  languageFromPath,
  type IndexResult,
  type KnowledgeGraphData,
  type ScanResult,
} from "@/lib/api";

export interface Analysis {
  repo: ScanResult;
  index: IndexResult | null;
  /** Why indexing did not produce results (skipped or failed). */
  indexNote: string | null;
  indexFailed: boolean;
}

type Phase = "idle" | "scanning" | "indexing";

interface RepositoryPanelProps {
  analysis: Analysis | null;
  graph: KnowledgeGraphData | null;
  scannerOpen: boolean;
  onAnalyzed: (analysis: Analysis) => void;
  onClose: () => void;
}

// The backend expects an absolute path: C:\..., \\server\..., /..., or ~/...
const ABSOLUTE_PATH = /^([a-zA-Z]:[\\/]|\\\\|\/|~[\\/]?)/;

const STEPS = [
  { title: "Scan", text: "Point the scanner at a local repository to inventory its files and lines of code." },
  { title: "Explore", text: "Browse the knowledge graph of files, functions and classes and how they call, import and contain each other." },
  { title: "Analyze impact", text: "Pick a symbol to see everything that could break if it changes, ordered by distance." },
];

const fmt = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString());

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-slate-100">{value}</dd>
      {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export default function RepositoryPanel({ analysis, graph, scannerOpen, onAnalyzed, onClose }: RepositoryPanelProps) {
  const [path, setPath] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const busy = phase !== "idle";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const trimmed = path.trim().replace(/^["']|["']$/g, "");
    if (!trimmed) return setError("Enter the absolute path of a local repository.");
    if (!ABSOLUTE_PATH.test(trimmed)) {
      return setError("Use an absolute path, e.g. C:\\Projects\\my-repo or /home/me/my-repo.");
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setPhase("scanning");

    let repo: ScanResult;
    try {
      repo = await api.scanRepository(trimmed, controller.signal);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(`Scan failed: ${err instanceof Error ? err.message : "unknown error"}`);
      setPhase("idle");
      return;
    }

    // /index needs file contents; only index files the scan response actually carried.
    const indexable = repo.files
      .filter((f) => typeof f.source_code === "string" && f.source_code.length > 0)
      .map((f) => ({
        file_path: f.file_path,
        source_code: f.source_code as string,
        language: f.language ?? languageFromPath(f.file_path),
      }));

    if (indexable.length === 0) {
      onAnalyzed({
        repo,
        index: null,
        indexNote: "The scan response did not include file contents, so indexing was skipped.",
        indexFailed: false,
      });
      setPhase("idle");
      return;
    }

    setPhase("indexing");
    try {
      const index = await api.indexFiles(indexable, controller.signal);
      onAnalyzed({ repo, index, indexNote: null, indexFailed: false });
    } catch (err) {
      if (isAbortError(err)) return;
      onAnalyzed({
        repo,
        index: null,
        indexNote: `Indexing failed: ${err instanceof Error ? err.message : "unknown error"}`,
        indexFailed: true,
      });
    }
    setPhase("idle");
  };

  const languages = useMemo(() => {
    if (!analysis) return [];
    const counts = new Map<string, number>();
    for (const f of analysis.repo.files) {
      const lang = f.language ?? languageFromPath(f.file_path);
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [analysis]);

  const status = (() => {
    if (phase === "scanning") return { label: "Scanning…", tone: "text-sky-300", spin: true };
    if (phase === "indexing") return { label: "Indexing…", tone: "text-sky-300", spin: true };
    if (!analysis) return { label: "No repository scanned", tone: "text-slate-400", spin: false };
    if (analysis.indexFailed) return { label: "Index failed", tone: "text-rose-300", spin: false };
    if (analysis.index) return { label: "Indexed", tone: "text-emerald-300", spin: false };
    return { label: "Scanned · not indexed", tone: "text-amber-300", spin: false };
  })();

  const showForm = scannerOpen || (!analysis && phase === "idle");

  return (
    <section aria-label="Repository" className="rounded-md border border-slate-800 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FolderGit2 className="h-4 w-4 shrink-0 text-slate-500" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-100">{analysis ? analysis.repo.name : "Repository"}</h2>
            {analysis && <p className="truncate font-mono text-[11px] text-slate-500">{analysis.repo.path}</p>}
          </div>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${status.tone}`}>
          {status.spin ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : analysis && !analysis.indexFailed && analysis.index ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : null}
          {status.label}
        </span>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 border-b border-slate-800 px-4 py-4">
          <label htmlFor="repo-path" className="block text-xs font-medium text-slate-300">
            Local repository path
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="repo-path"
              type="text"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                if (error) setError(null);
              }}
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
              placeholder="C:\Projects\my-repo   or   /home/me/my-repo"
              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {phase === "scanning" ? "Scanning…" : phase === "indexing" ? "Indexing…" : "Scan repository"}
            </button>
            {analysis && !busy && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            The path is resolved by the backend, so it must exist on the machine running the API.
          </p>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{error}</span>
            </p>
          )}
        </form>
      )}

      {!analysis && (
        <ol aria-label="How it works" className="grid divide-y divide-slate-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3 px-4 py-3.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700 font-mono text-[11px] text-slate-400">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-100">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {analysis && (
        <>
          <dl className="grid grid-cols-2 divide-x divide-y divide-slate-800 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            <Stat label="Files" value={fmt(analysis.repo.total_files)} />
            <Stat label="Lines of code" value={fmt(analysis.repo.total_loc)} />
            <Stat label="Indexed files" value={fmt(analysis.index?.indexed_files)} />
            <Stat label="Symbols" value={fmt(analysis.index?.total_symbols)} />
            <Stat label="Chunks" value={fmt(analysis.index?.total_chunks)} />
            <Stat
              label="Graph"
              value={graph ? `${graph.nodes.length.toLocaleString()} / ${graph.edges.length.toLocaleString()}` : "—"}
              hint="nodes / edges"
            />
          </dl>

          {(languages.length > 0 || analysis.repo.git || analysis.indexNote) && (
            <div className="space-y-2 border-t border-slate-800 px-4 py-3 text-xs">
              {languages.length > 0 && (
                <p className="text-slate-400">
                  <span className="text-slate-500">Languages </span>
                  {languages.map(([lang, count]) => `${lang} (${count})`).join(" · ")}
                </p>
              )}
              {analysis.repo.git && (
                <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-slate-400">
                  {Object.entries(analysis.repo.git).slice(0, 5).map(([k, v]) => (
                    <span key={k} className="max-w-full truncate">
                      <span className="text-slate-500">{k}: </span>
                      {String(v)}
                    </span>
                  ))}
                </p>
              )}
              {analysis.indexNote && (
                <p className={`flex items-start gap-2 ${analysis.indexFailed ? "text-rose-300" : "text-amber-300"}`}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">{analysis.indexNote}</span>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
