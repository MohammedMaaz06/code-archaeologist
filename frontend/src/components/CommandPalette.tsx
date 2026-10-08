"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { GraphNode } from "@/lib/api";
import { nodeColor } from "@/lib/graphTheme";
import { Kbd } from "@/components/ui";

interface CommandPaletteProps {
  open: boolean;
  nodes: GraphNode[];
  onClose: () => void;
  /** `impact` when the user confirmed with Shift+Enter. */
  onPick: (id: string, target: "graph" | "impact") => void;
}

const MAX_RESULTS = 12;

function rank(n: GraphNode, q: string): number {
  const label = n.label.toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (label.includes(q)) return 2;
  return 3;
}

export default function CommandPalette({ open, nodes, onClose, onPick }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Wait for the dialog to mount before focusing.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const haystack = useMemo(() => nodes.map((n) => ({ n, text: `${n.id} ${n.label} ${n.type}`.toLowerCase() })), [nodes]);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const q = terms.join(" ");
    return haystack
      .filter(({ text }) => terms.every((t) => text.includes(t)))
      .map(({ n }) => n)
      .sort((a, b) => rank(a, q) - rank(b, q))
      .slice(0, MAX_RESULTS);
  }, [haystack, query]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      onPick(results[active].id, e.shiftKey ? "impact" : "graph");
    }
  };

  const searching = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-100/30 px-4 pt-[14vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Find a symbol" onKeyDown={onKey} className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search symbols by name, ID or type…"
            aria-label="Search symbols"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
          {results.map((n, i) => (
            <li
              key={n.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(n.id, e.shiftKey ? "impact" : "graph");
              }}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? "bg-slate-800" : ""}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: nodeColor(n.type) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-100">{n.label}</span>
                <span className="block truncate font-mono text-[11px] text-slate-500">{n.id}</span>
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">{n.type}</span>
            </li>
          ))}
          {searching && results.length === 0 && <li className="px-4 py-6 text-center text-xs text-slate-500">No symbols match &ldquo;{query.trim()}&rdquo;.</li>}
          {!searching && <li className="px-4 py-6 text-center text-xs text-slate-500">{nodes.length ? `Search ${nodes.length.toLocaleString()} symbols across the graph.` : "The graph has no symbols yet."}</li>}
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 bg-slate-950 px-4 py-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd> open in graph</span>
          <span className="flex items-center gap-1.5"><Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> analyze impact</span>
        </div>
      </div>
    </div>
  );
}
