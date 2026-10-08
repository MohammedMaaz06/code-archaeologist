"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Download, FileText, Loader2, MousePointerClick, RefreshCw } from "lucide-react";
import type { BlastRadiusResult, GraphNode } from "@/lib/api";
import { fileOf } from "@/lib/graphAnalytics";
import { IMPACT_ROOT, impactColor, nodeColor } from "@/lib/graphTheme";
import { buildImpactJson, buildImpactMarkdown, downloadText, reportFileName } from "@/lib/impactReport";
import { CopyableId, TypeBadge } from "@/components/NodeInspector";
import { StackedBar } from "@/components/ui";

interface ImpactPanelProps {
  node: GraphNode | null;
  selectedId: string | null;
  depth: number;
  onDepthChange: (depth: number) => void;
  loading: boolean;
  error: string | null;
  result: BlastRadiusResult | null;
  nodesById: Map<string, GraphNode>;
  /** Total nodes in the graph, used for the "share of graph" figure. */
  totalNodes: number;
  onRetry: () => void;
  onFocusNode: (id: string) => void;
}

const DEPTHS = Array.from({ length: 10 }, (_, i) => i + 1);
const LIST_LIMIT = 40;

const formatShare = (part: number, whole: number) => {
  if (!whole) return "—";
  const v = (part / whole) * 100;
  return v > 0 && v < 0.1 ? "<0.1%" : `${v.toFixed(v < 10 ? 1 : 0)}%`;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

export default function ImpactPanel({
  node, selectedId, depth, onDepthChange, loading, error, result, nodesById, totalNodes, onRetry, onFocusNode,
}: ImpactPanelProps) {
  const id = node?.id ?? selectedId;

  // Group affected nodes by distance from the selected symbol.
  const groups = useMemo(() => {
    if (!result) return [];
    const byDepth = new Map<number, string[]>();
    for (const a of result.affected) {
      const d = a.depth ?? 0; // 0 = backend did not report a depth
      byDepth.set(d, [...(byDepth.get(d) ?? []), a.id]);
    }
    return [...byDepth.entries()].sort((a, b) => a[0] - b[0]);
  }, [result]);

  // Breakdowns computed from the affected set and the exported graph.
  const breakdown = useMemo(() => {
    if (!result) return null;
    const types = new Map<string, number>();
    const files = new Map<string, number>();
    let deepest = 0;
    for (const a of result.affected) {
      const n = nodesById.get(a.id);
      const type = n?.type ?? "unknown";
      types.set(type, (types.get(type) ?? 0) + 1);
      const f = n ? fileOf(n) : undefined;
      if (f) files.set(f, (files.get(f) ?? 0) + 1);
      if (a.depth && a.depth > deepest) deepest = a.depth;
    }
    const byCount = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { types: byCount(types), files: byCount(files), deepest };
  }, [result, nodesById]);

  const maxGroup = Math.max(1, ...groups.map(([, ids]) => ids.length));
  const hasDepths = groups.some(([d]) => d > 0);

  if (!id) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <MousePointerClick className="h-6 w-6 text-slate-600" />
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Impact analysis</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Select a symbol in the graph or search for one. The blast radius shows every piece of code that could be affected
            by changing it.
          </p>
        </div>
      </div>
    );
  }

  const exportInput = result ? { result, depth, nodesById } : null;
  const label = node?.label ?? id;

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Selected symbol</p>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-sm font-semibold text-slate-100">{label}</h3>
          {node && <TypeBadge type={node.type} />}
        </div>
        <CopyableId id={id} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Max depth</label>
          <span className="font-mono text-xs text-slate-300">{depth}</span>
        </div>
        <div role="radiogroup" aria-label="Blast radius depth" className="grid grid-cols-10 overflow-hidden rounded-md border border-slate-700">
          {DEPTHS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === depth}
              onClick={() => onDepthChange(d)}
              className={`border-r border-slate-700 py-1.5 font-mono text-xs transition-colors last:border-r-0 ${
                d === depth ? "bg-sky-600 text-white" : "bg-slate-950 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" /> Calculating blast radius…
        </p>
      )}

      {!loading && error && (
        <div role="alert" className="space-y-2 rounded-md border border-rose-900 bg-rose-950/40 p-3">
          <p className="flex items-start gap-2 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">{error}</span>
          </p>
          <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-slate-100">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {!loading && !error && result && breakdown && (
        <div className="space-y-4 border-t border-slate-800 pt-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total impacted</p>
              <p className={`font-mono text-3xl font-semibold tabular-nums ${result.totalImpacted > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {result.totalImpacted.toLocaleString()}
              </p>
            </div>
            {exportInput && (
              <div className="flex gap-1.5 pb-1">
                <button
                  type="button"
                  title="Download the full affected list as Markdown"
                  onClick={() => downloadText(reportFileName(label, depth, "md"), buildImpactMarkdown(exportInput), "text/markdown")}
                  className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <FileText className="h-3 w-3" /> Markdown
                </button>
                <button
                  type="button"
                  title="Download the full affected list as JSON"
                  onClick={() => downloadText(reportFileName(label, depth, "json"), buildImpactJson(exportInput), "application/json")}
                  className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <Download className="h-3 w-3" /> JSON
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metric label="Of graph" value={formatShare(result.totalImpacted, totalNodes)} />
            <Metric label="Reach" value={breakdown.deepest > 0 ? `${breakdown.deepest} hop${breakdown.deepest === 1 ? "" : "s"}` : "—"} />
            <Metric label="Files" value={breakdown.files.length ? String(breakdown.files.length) : "—"} />
          </div>

          {result.totalImpacted === 0 ? (
            <p className="rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              Nothing else depends on this symbol within {depth} level{depth === 1 ? "" : "s"}. A change here is isolated.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">By type</p>
                <StackedBar segments={breakdown.types.map(([t, v]) => ({ label: t, value: v, color: nodeColor(t) }))} />
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  {breakdown.types.map(([t, v]) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: nodeColor(t) }} />
                      {t} <span className="font-mono text-slate-500">{v}</span>
                    </span>
                  ))}
                </p>
              </div>

              {breakdown.files.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Most affected files</p>
                  <ul className="space-y-1">
                    {breakdown.files.slice(0, 5).map(([file, count]) => (
                      <li key={file} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-mono text-[11px] text-slate-300" title={file}>{file}</span>
                        <span className="shrink-0 font-mono tabular-nums text-slate-500">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ol className="space-y-3 border-t border-slate-800 pt-4">
                <li className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-slate-100" />
                  <span className="truncate">{label}</span>
                  <span className="text-slate-600">changes</span>
                </li>
                {groups.map(([d, ids]) => (
                  <li key={d} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d === 0 ? IMPACT_ROOT : impactColor(d) }} />
                      <span className="text-xs font-medium text-slate-200">{d === 0 ? "Affected" : `Depth ${d}`}</span>
                      <div className="h-1 flex-1 overflow-hidden rounded bg-slate-800">
                        <div className="h-full rounded" style={{ width: `${(ids.length / maxGroup) * 100}%`, backgroundColor: d === 0 ? IMPACT_ROOT : impactColor(d) }} />
                      </div>
                      <span className="font-mono text-xs text-slate-400">{ids.length}</span>
                    </div>
                    <ul className="ml-4 space-y-0.5 border-l border-slate-800 pl-3">
                      {ids.slice(0, LIST_LIMIT).map((affectedId) => {
                        const known = nodesById.get(affectedId);
                        return (
                          <li key={affectedId}>
                            <button
                              type="button"
                              disabled={!known}
                              onClick={() => onFocusNode(affectedId)}
                              title={affectedId}
                              className="flex w-full flex-col rounded px-1.5 py-1 text-left transition-colors enabled:hover:bg-slate-800 disabled:cursor-default"
                            >
                              <span className="truncate text-xs text-slate-200">{known?.label ?? affectedId}</span>
                              <span className="truncate font-mono text-[10px] text-slate-500">
                                {known ? known.type : "not in graph"} · {affectedId}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {ids.length > LIST_LIMIT && <li className="px-1.5 text-[11px] text-slate-600">+{ids.length - LIST_LIMIT} more (full list in the export)</li>}
                    </ul>
                  </li>
                ))}
                {!hasDepths && <li className="text-[11px] text-slate-500">The backend did not report per-node depth, so results are not grouped by distance.</li>}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
