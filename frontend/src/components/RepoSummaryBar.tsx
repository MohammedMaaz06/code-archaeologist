import React from "react";
import { FolderGit2 } from "lucide-react";
import type { Analysis } from "@/components/RepositoryPanel";

const fmt = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString());

/** One-line repository context shown above the graph and impact workspaces. */
export default function RepoSummaryBar({ analysis, onScan }: { analysis: Analysis | null; onScan: () => void }) {
  const stats = analysis
    ? [
        ["Files", fmt(analysis.repo.total_files)],
        ["LOC", fmt(analysis.repo.total_loc)],
        ["Indexed", fmt(analysis.index?.indexed_files)],
        ["Symbols", fmt(analysis.index?.total_symbols)],
      ]
    : [];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-slate-800 bg-slate-900 px-4 py-2.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <FolderGit2 className="h-4 w-4 shrink-0 text-slate-500" />
        {analysis ? (
          <p className="min-w-0 truncate text-xs">
            <span className="font-semibold text-slate-100">{analysis.repo.name}</span>
            <span className="ml-2 font-mono text-[11px] text-slate-500">{analysis.repo.path}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-500">No repository scanned in this session. Showing the graph currently held by the backend.</p>
        )}
      </div>
      <dl className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1">
        {stats.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-1.5">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
            <dd className="font-mono text-xs font-semibold tabular-nums text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onScan} className="text-xs font-medium text-sky-600 hover:underline">
        {analysis ? "Rescan" : "Scan a repository"}
      </button>
    </div>
  );
}
