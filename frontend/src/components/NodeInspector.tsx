"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, Loader2, ShieldAlert } from "lucide-react";
import { api, type GraphNode, type KnowledgeGraphData, type SymbolRef } from "@/lib/api";
import { nodeColor } from "@/lib/graphTheme";
import { useApiResource } from "@/lib/useApiResource";

interface NodeInspectorProps {
  graph: KnowledgeGraphData | null;
  node: GraphNode | null;
  /** Selected id that is not (or no longer) present in the graph payload. */
  selectedId: string | null;
  nodesById: Map<string, GraphNode>;
  onNavigate: (id: string) => void;
  onAnalyzeImpact: () => void;
}

const LIST_LIMIT = 30;

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: nodeColor(type) }} />
      {type}
    </span>
  );
}

export function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable (insecure context) — ignore */
    }
  };
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950 p-2">
      <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-slate-300">{id}</code>
      <button type="button" onClick={copy} aria-label="Copy symbol ID" className="shrink-0 text-slate-500 hover:text-slate-200">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function RefList({
  title, icon: Icon, loading, error, items, nodesById, onNavigate,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  error: string | null;
  items: SymbolRef[] | null;
  nodesById: Map<string, GraphNode>;
  onNavigate: (id: string) => void;
}) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
        {items && <span className="font-mono normal-case text-slate-400">{items.length}</span>}
      </h4>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</p>
      ) : error ? (
        <p className="break-words text-xs text-rose-400">{error}</p>
      ) : !items || items.length === 0 ? (
        <p className="text-xs text-slate-600">None</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, LIST_LIMIT).map((ref) => {
            const known = nodesById.get(ref.id);
            return (
              <li key={ref.id}>
                <button
                  type="button"
                  disabled={!known}
                  onClick={() => onNavigate(ref.id)}
                  title={ref.id}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors enabled:hover:bg-slate-800 disabled:cursor-default"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: nodeColor(known?.type ?? "unknown") }} />
                  <span className="truncate text-xs text-slate-300">{known?.label ?? ref.label ?? ref.id}</span>
                </button>
              </li>
            );
          })}
          {items.length > LIST_LIMIT && <li className="px-1.5 text-[11px] text-slate-600">+{items.length - LIST_LIMIT} more</li>}
        </ul>
      )}
    </div>
  );
}

export default function NodeInspector({ graph, node, selectedId, nodesById, onNavigate, onAnalyzeImpact }: NodeInspectorProps) {
  const id = node?.id ?? selectedId;

  // Relationship summary derived from the exported graph edges.
  const relationships = useMemo(() => {
    if (!graph || !id) return null;
    const out = new Map<string, number>();
    const inc = new Map<string, number>();
    for (const e of graph.edges) {
      if (e.source === id) out.set(e.relationship, (out.get(e.relationship) ?? 0) + 1);
      if (e.target === id) inc.set(e.relationship, (inc.get(e.relationship) ?? 0) + 1);
    }
    return { out: [...out.entries()], inc: [...inc.entries()] };
  }, [graph, id]);

  const callers = useApiResource(id ? (signal) => api.getCallers(id, signal) : null, [id]);
  const callees = useApiResource(id ? (signal) => api.getCallees(id, signal) : null, [id]);

  // ---- nothing selected: summarize the graph ------------------------------
  if (!id) {
    return (
      <div className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-slate-100">Symbol inspector</h3>
        <p className="text-xs leading-relaxed text-slate-500">
          Select a node in the graph, or search for a symbol, to see its type, full ID and relationships. Then run an impact
          analysis to see what a change to it could affect.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-sm font-semibold text-slate-100">{node?.label ?? id}</h3>
          {node && <TypeBadge type={node.type} />}
        </div>
        {!node && (
          <p className="flex items-center gap-1.5 text-xs text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" /> This ID is not in the current graph export.
          </p>
        )}
        <CopyableId id={id} />
        {node?.filePath && <p className="break-all font-mono text-[11px] text-slate-500">{node.filePath}</p>}
      </div>

      <button
        type="button"
        onClick={onAnalyzeImpact}
        className="w-full rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-500"
      >
        Analyze impact of this symbol
      </button>

      {relationships && (relationships.out.length > 0 || relationships.inc.length > 0) && (
        <div className="space-y-1.5 border-t border-slate-800 pt-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Graph relationships</h4>
          <ul className="space-y-1 text-xs text-slate-400">
            {relationships.out.map(([rel, n]) => (
              <li key={`o-${rel}`} className="flex justify-between"><span>{rel} (outgoing)</span><span className="font-mono text-slate-300">{n}</span></li>
            ))}
            {relationships.inc.map(([rel, n]) => (
              <li key={`i-${rel}`} className="flex justify-between"><span>{rel} (incoming)</span><span className="font-mono text-slate-300">{n}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 border-t border-slate-800 pt-3">
        <RefList title="Callers" icon={ArrowDownToLine} loading={callers.loading} error={callers.error} items={callers.data} nodesById={nodesById} onNavigate={onNavigate} />
        <RefList title="Callees" icon={ArrowUpFromLine} loading={callees.loading} error={callees.error} items={callees.data} nodesById={nodesById} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
