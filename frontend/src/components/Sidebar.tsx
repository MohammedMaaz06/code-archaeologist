"use client";

import React from "react";
import { Crosshair, LayoutDashboard, Network, Wrench } from "lucide-react";
import type { GraphNode } from "@/lib/api";
import { nodeColor } from "@/lib/graphTheme";

export type View = "overview" | "graph" | "impact" | "codefix";

export const VIEW_META: Record<View, { label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  overview: { label: "Overview", description: "Repository and graph analytics", icon: LayoutDashboard },
  graph: { label: "Dependency Graph", description: "Explore code relationships", icon: Network },
  impact: { label: "Impact Analysis", description: "Blast radius of a change", icon: Crosshair },
  codefix: { label: "AI Code Fix", description: "Generate and review code corrections", icon: Wrench },
};

const ORDER: View[] = ["overview", "graph", "impact", "codefix"];

interface NavProps {
  view: View;
  onChange: (view: View) => void;
  /** Small counters shown beside each item, when known. */
  badges: Partial<Record<View, string>>;
}

export function MobileNav({ view, onChange, badges }: NavProps) {
  return (
    <nav aria-label="Primary (mobile)" className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-800 px-4 sm:-mx-6 sm:px-6 lg:hidden">
      {ORDER.map((id) => {
        const { label } = VIEW_META[id];
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              active ? "border-sky-500 text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
            {badges[id] && <span className="ml-1.5 font-mono text-[10px] text-slate-500">{badges[id]}</span>}
          </button>
        );
      })}
    </nav>
  );
}

interface SidebarProps extends NavProps {
  selected: GraphNode | null;
  selectedId: string | null;
  onOpenPalette: () => void;
}

export default function Sidebar({ view, onChange, badges, selected, selectedId, onOpenPalette }: SidebarProps) {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900 lg:flex">
      <div className="px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Workspace</p>
        <nav aria-label="Primary" className="space-y-0.5">
          {ORDER.map((id) => {
            const { label, icon: Icon } = VIEW_META[id];
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(id)}
                className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                  active ? "bg-slate-800 font-medium text-slate-100" : "text-slate-400 hover:bg-slate-950 hover:text-slate-100"
                }`}
              >
                {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sky-600" />}
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-sky-600" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span className="flex-1 truncate">{label}</span>
                {badges[id] && <span className="font-mono text-[11px] tabular-nums text-slate-500">{badges[id]}</span>}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onOpenPalette}
          className="mt-4 w-full rounded-md border border-dashed border-slate-700 px-2.5 py-2 text-left text-xs text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300"
        >
          Find a symbol…
        </button>
      </div>

      <div className="border-t border-slate-800 px-4 py-3">
        <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Selected symbol</p>
        {selectedId ? (
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 truncate text-xs font-medium text-slate-100">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: nodeColor(selected?.type ?? "unknown") }} />
              <span className="truncate">{selected?.label ?? selectedId}</span>
            </p>
            <p className="truncate font-mono text-[10px] text-slate-500" title={selectedId}>
              {selectedId}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">None. Pick one in the graph or search.</p>
        )}
      </div>
    </aside>
  );
}
