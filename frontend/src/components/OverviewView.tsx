"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Boxes, Flame, FileCode2, GitFork, RefreshCw, Share2, Unlink } from "lucide-react";
import type { KnowledgeGraphData } from "@/lib/api";
import { analyzeGraph } from "@/lib/graphAnalytics";
import { DEFAULT_EDGE_COLOR, EDGE_COLORS, nodeColor } from "@/lib/graphTheme";
import { Kpi, MeterRow, Panel, Skeleton, StackedBar } from "@/components/ui";
import { TypeBadge } from "@/components/NodeInspector";

interface OverviewViewProps {
  graph: KnowledgeGraphData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onScan: () => void;
  onOpenSymbol: (id: string, target: "graph" | "impact") => void;
}

const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%` : "0%");

export default function OverviewView({ graph, loading, error, onRetry, onScan, onOpenSymbol }: OverviewViewProps) {
  const stats = useMemo(() => (graph && graph.nodes.length > 0 ? analyzeGraph(graph) : null), [graph]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading graph analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[84px]" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
          <div>
            <p className="text-sm font-medium text-slate-200">Graph analytics unavailable</p>
            <p className="mt-1 max-w-md break-words text-xs text-slate-500">{error}</p>
          </div>
          <button type="button" onClick={onRetry} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </Panel>
    );
  }

  if (!stats) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Boxes className="h-6 w-6 text-slate-600" />
          <div>
            <p className="text-sm font-medium text-slate-200">No graph data yet</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">Scan and index a repository to see its structure, hotspots and relationship breakdown here.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onScan} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500">Scan a repository</button>
            <button type="button" onClick={onRetry} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  const maxType = stats.typeCounts[0]?.[1] ?? 1;
  const maxRel = stats.relCounts[0]?.[1] ?? 1;
  const maxDependents = stats.hotspots[0]?.dependents ?? 1;
  const maxFile = stats.files[0]?.symbols ?? 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Boxes} label="Graph nodes" value={stats.nodeCount.toLocaleString()} hint={`${stats.symbolCount.toLocaleString()} symbols`} />
        <Kpi icon={Share2} label="Relationships" value={stats.edgeCount.toLocaleString()} hint={`${stats.avgConnections.toFixed(1)} avg connections per node`} />
        <Kpi
          icon={Unlink}
          label="Isolated nodes"
          value={stats.isolated.toLocaleString()}
          hint={stats.isolated === 0 ? "Everything is connected" : `${pct(stats.isolated, stats.nodeCount)} of nodes have no edges`}
        />
        <Kpi
          icon={Flame}
          label="Most depended-on"
          value={stats.hotspots[0] ? stats.hotspots[0].dependents.toLocaleString() : "—"}
          hint={stats.hotspots[0] ? stats.hotspots[0].node.label : "No call or import edges"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Composition" subtitle="What the graph is made of, by node type">
          <div className="space-y-4 p-4">
            <StackedBar segments={stats.typeCounts.map(([type, value]) => ({ label: type, value, color: nodeColor(type) }))} />
            <div className="space-y-3">
              {stats.typeCounts.map(([type, count]) => (
                <MeterRow
                  key={type}
                  label={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: nodeColor(type) }} />{type}</span>}
                  value={count}
                  max={maxType}
                  color={nodeColor(type)}
                  right={`${count.toLocaleString()} · ${pct(count, stats.nodeCount)}`}
                />
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Relationships" subtitle="How code entities connect">
          <div className="space-y-3 p-4">
            {stats.relCounts.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">The graph has no relationships.</p>
            ) : (
              stats.relCounts.map(([rel, count]) => (
                <MeterRow
                  key={rel}
                  label={<span className="capitalize">{rel}</span>}
                  value={count}
                  max={maxRel}
                  color={EDGE_COLORS[rel] ?? DEFAULT_EDGE_COLOR}
                  right={`${count.toLocaleString()} · ${pct(count, stats.edgeCount)}`}
                />
              ))
            )}
            {graph && graph.skippedEdges > 0 && (
              <p className="flex items-start gap-2 border-t border-slate-800 pt-3 text-[11px] text-amber-300">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {graph.skippedEdges.toLocaleString()} edge(s) reference a node missing from the export and are excluded.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Hotspots"
          subtitle="Most depended-on symbols: highest-risk places to change"
          bodyClassName="relative overflow-x-auto"
        >
          {stats.hotspots.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-slate-500">No call, import or inheritance edges, so no dependents to rank.</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2 font-medium">Symbol</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 text-right font-medium">Dependents</th>
                  <th className="px-2 py-2 text-right font-medium">Depends on</th>
                  <th className="px-4 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats.hotspots.map(({ node, dependents, dependencies }) => (
                  <tr key={node.id} className="transition-colors hover:bg-slate-950">
                    <td className="max-w-[260px] px-4 py-2.5">
                      <p className="truncate font-medium text-slate-100">{node.label}</p>
                      <p className="truncate font-mono text-[10px] text-slate-500" title={node.id}>{node.id}</p>
                    </td>
                    <td className="px-2 py-2.5"><TypeBadge type={node.type} /></td>
                    <td className="px-2 py-2.5">
                      <div className="ml-auto flex w-28 items-center justify-end gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <span className="block h-full rounded-full bg-rose-500" style={{ width: `${(dependents / maxDependents) * 100}%` }} />
                        </span>
                        <span className="w-6 text-right font-mono tabular-nums text-slate-100">{dependents}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-400">{dependencies}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button type="button" onClick={() => onOpenSymbol(node.id, "graph")} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100">Graph</button>
                      <button type="button" onClick={() => onOpenSymbol(node.id, "impact")} className="rounded px-2 py-1 font-medium text-sky-600 hover:bg-slate-800">Analyze</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Largest files" subtitle="By number of contained symbols">
          <div className="space-y-3 p-4">
            {stats.files.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">Nodes carry no file information.</p>
            ) : (
              stats.files.map((f) => (
                <MeterRow
                  key={f.file}
                  label={<span className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5 shrink-0 text-slate-500" /><span className="truncate font-mono text-[11px]" title={f.file}>{f.file}</span></span>}
                  value={f.symbols}
                  max={maxFile}
                  color="#5b8a6e"
                  right={`${f.symbols.toLocaleString()} ${f.symbols === 1 ? "symbol" : "symbols"}`}
                />
              ))
            )}
          </div>
          <p className="flex items-center gap-1.5 border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-500">
            <GitFork className="h-3 w-3" /> Counts exclude file nodes themselves.
          </p>
        </Panel>
      </div>
    </div>
  );
}
