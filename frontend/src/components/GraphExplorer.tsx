"use client";

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { AlertTriangle, Loader2, Maximize2, Network, RefreshCw, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import type { GraphNode, KnowledgeGraphData } from "@/lib/api";
import { DEFAULT_EDGE_COLOR, EDGE_COLORS, IMPACT_COLORS, impactColor, nodeColor } from "@/lib/graphTheme";

export interface FocusRequest {
  id: string;
  nonce: number;
}

interface GraphExplorerProps {
  graph: KnowledgeGraphData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenScanner: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mode: "graph" | "impact";
  /** Affected node id -> depth, present when a blast-radius result is shown. */
  impactDepths: Map<string, number> | null;
  focusRequest: FocusRequest | null;
  /** False while another view is shown; the instance stays mounted so zoom and layout survive. */
  visible?: boolean;
}

const MAX_SUGGESTIONS = 8;
const LARGE_GRAPH = 1500;
const FORCE_LAYOUT_MAX = 600;

const impactClass = (depth: number) => `imp${Math.min(Math.max(depth, 1), IMPACT_COLORS.length)}`;

const STYLE: cytoscape.StylesheetStyle[] = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      label: "data(label)",
      color: "#4a4337",
      "font-size": 10,
      "text-valign": "bottom",
      "text-margin-y": 4,
      "text-max-width": "120px",
      "text-wrap": "ellipsis",
      "text-outline-width": 2,
      "text-outline-color": "#f3eee3",
      "min-zoomed-font-size": 9,
      "border-width": 0,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1,
      "line-color": "data(color)",
      "target-arrow-color": "data(color)",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      "curve-style": "bezier",
      opacity: 0.7,
      "font-size": 8,
      color: "#766d5c",
      "text-outline-width": 2,
      "text-outline-color": "#f3eee3",
    },
  },
  { selector: 'edge[rel = "imports"]', style: { "line-style": "dashed" } },
  { selector: 'edge[rel = "contains"]', style: { "line-style": "dotted" } },
  { selector: ".hidden", style: { display: "none" } },
  { selector: "node.dim", style: { opacity: 0.12, "text-opacity": 0 } },
  { selector: "edge.dim", style: { opacity: 0.04 } },
  { selector: "node.hit", style: { "border-width": 2, "border-color": "#2a251c" } },
  { selector: "node.nbr", style: { "border-width": 2, "border-color": "#2f5d52" } },
  { selector: "edge.nbrEdge", style: { opacity: 1, width: 1.5, label: "data(rel)" } },
  { selector: "edge.impEdge", style: { opacity: 0.9, width: 1.5, "line-color": "#b5392f", "target-arrow-color": "#b5392f" } },
  ...IMPACT_COLORS.map(
    (color, i): cytoscape.StylesheetStyle => ({
      selector: `node.imp${i + 1}`,
      style: { "background-color": color, "border-width": 2, "border-color": color, "text-opacity": 1 },
    })
  ),
  { selector: "node.sel", style: { "border-width": 4, "border-color": "#2a251c", "text-opacity": 1, "z-index": 10 } },
];

function scoreNode(n: GraphNode, q: string): number {
  const label = n.label.toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (label.includes(q)) return 2;
  if (n.id.toLowerCase().includes(q)) return 3;
  return 4;
}

export default function GraphExplorer({
  graph, loading, error, onRetry, onOpenScanner, selectedId, onSelect, mode, impactDepths, focusRequest, visible = true,
}: GraphExplorerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [query, setQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const deferredQuery = useDeferredValue(query);

  const hasGraph = !!graph && graph.nodes.length > 0;

  // A freshly loaded graph (e.g. after a rescan) invalidates any active search or type filter.
  useEffect(() => {
    setQuery("");
    setHiddenTypes(new Set());
  }, [graph]);

  // ---- derived data -------------------------------------------------------
  const haystack = useMemo(
    () => (graph ? graph.nodes.map((n) => ({ n, text: `${n.id} ${n.label} ${n.type}`.toLowerCase() })) : []),
    [graph]
  );

  const matchedNodes = useMemo(() => {
    const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return null;
    return haystack.filter(({ text }) => terms.every((t) => text.includes(t))).map(({ n }) => n);
  }, [haystack, deferredQuery]);

  const matchedIds = useMemo(() => (matchedNodes ? new Set(matchedNodes.map((n) => n.id)) : null), [matchedNodes]);

  const suggestions = useMemo(() => {
    if (!matchedNodes) return [];
    const q = deferredQuery.trim().toLowerCase();
    return [...matchedNodes].sort((a, b) => scoreNode(a, q) - scoreNode(b, q)).slice(0, MAX_SUGGESTIONS);
  }, [matchedNodes, deferredQuery]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    graph?.nodes.forEach((n) => counts.set(n.type, (counts.get(n.type) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  const relCounts = useMemo(() => {
    const counts = new Map<string, number>();
    graph?.edges.forEach((e) => counts.set(e.relationship, (counts.get(e.relationship) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  // ---- build the cytoscape instance once per graph payload ----------------
  const runLayout = useRef<() => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !graph || graph.nodes.length === 0) return;

    const degree = new Map<string, number>();
    for (const e of graph.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const big = graph.nodes.length > LARGE_GRAPH;

    const cy = cytoscape({
      container,
      elements: [
        ...graph.nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.label,
            type: n.type,
            color: nodeColor(n.type),
            size: 14 + Math.min(Math.sqrt(degree.get(n.id) ?? 0) * 3, 20),
          },
        })),
        ...graph.edges.map((e) => ({
          data: { id: e.id, source: e.source, target: e.target, rel: e.relationship, color: EDGE_COLORS[e.relationship] ?? DEFAULT_EDGE_COLOR },
        })),
      ],
      style: STYLE,
      minZoom: 0.05,
      maxZoom: 3,
      textureOnViewport: big,
      hideEdgesOnViewport: big,
    });

    runLayout.current = () => {
      // Force-directed layout is O(n^2) and blocks the main thread, so very large graphs
      // use a cheap hub-centred layout instead.
      const options =
        graph.nodes.length > FORCE_LAYOUT_MAX
          ? ({
              name: "concentric",
              animate: false,
              fit: true,
              padding: 30,
              concentric: (n: cytoscape.NodeSingular) => n.degree(false),
              levelWidth: () => 2,
              minNodeSpacing: 6,
            } as cytoscape.LayoutOptions)
          : ({
              name: "cose",
              animate: false,
              fit: true,
              padding: 30,
              randomize: true,
              nodeRepulsion: () => 24000,
              idealEdgeLength: () => 110,
              componentSpacing: 80,
              numIter: 1000,
              // Reserve room for labels on graphs small enough to afford the extra layout work.
              nodeDimensionsIncludeLabels: graph.nodes.length <= 500,
            } as cytoscape.LayoutOptions);
      cy.layout(options).run();
    };
    runLayout.current();

    cy.on("tap", "node", (evt) => onSelectRef.current(evt.target.id()));
    cy.on("tap", (evt) => {
      if (evt.target === cy) onSelectRef.current(null);
    });
    cy.on("mouseover", "node", () => (container.style.cursor = "pointer"));
    cy.on("mouseout", "node", () => (container.style.cursor = "default"));

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph]);

  // ---- apply search / filter / selection / impact as style classes --------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass("dim hit nbr nbrEdge impEdge sel hidden imp1 imp2 imp3 imp4");

      if (hiddenTypes.size > 0) cy.nodes().forEach((n) => void (hiddenTypes.has(n.data("type")) && n.addClass("hidden")));

      const selected = selectedId ? cy.getElementById(selectedId) : null;
      const hasSelected = !!selected && selected.nonempty();

      if (mode === "impact" && impactDepths && hasSelected) {
        const inSet = (id: string) => id === selectedId || impactDepths.has(id);
        cy.nodes().forEach((n) => {
          const id = n.id();
          if (id === selectedId) return;
          const depth = impactDepths.get(id);
          if (depth !== undefined) n.addClass(impactClass(depth));
          else n.addClass("dim");
        });
        cy.edges().forEach((e) => {
          if (inSet(e.source().id()) && inSet(e.target().id())) e.addClass("impEdge");
          else e.addClass("dim");
        });
      } else if (matchedIds) {
        cy.nodes().forEach((n) => void (matchedIds.has(n.id()) ? n.addClass("hit") : n.addClass("dim")));
        cy.edges().forEach((e) => void (!(matchedIds.has(e.source().id()) && matchedIds.has(e.target().id())) && e.addClass("dim")));
      } else if (hasSelected && selected) {
        const hood = selected.closedNeighborhood();
        cy.elements().not(hood).addClass("dim");
        selected.neighborhood("node").addClass("nbr");
        selected.connectedEdges().addClass("nbrEdge");
      }

      if (hasSelected && selected) selected.addClass("sel");
    });
  }, [graph, selectedId, matchedIds, hiddenTypes, mode, impactDepths]);

  // ---- focus requests from outside (callers list, affected list) ----------
  const appliedFocus = useRef(0);
  useEffect(() => {
    const cy = cyRef.current;
    if (!visible) return;
    cy?.resize();
    if (!cy || !focusRequest || appliedFocus.current === focusRequest.nonce) return;
    appliedFocus.current = focusRequest.nonce;
    const node = cy.getElementById(focusRequest.id);
    if (node.nonempty()) cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1) }, { duration: 200 });
  }, [focusRequest, visible]);

  const pickSuggestion = (n: GraphNode) => {
    onSelect(n.id);
    setQuery(""); // otherwise the search dims everything except this node and hides its neighbourhood
    setSuggestOpen(false);
    const cy = cyRef.current;
    const node = cy?.getElementById(n.id);
    if (cy && node && node.nonempty()) cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1) }, { duration: 200 });
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestOpen(true);
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && suggestions[activeIdx]) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      if (suggestOpen) setSuggestOpen(false);
      else setQuery("");
    }
  };

  const toggleType = (type: string) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (!next.delete(type)) next.add(type);
      return next;
    });

  const zoomBy = (factor: number) => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  const searching = query.trim().length > 0;
  const noMatches = searching && matchedNodes !== null && matchedNodes.length === 0 && deferredQuery === query;

  // ---- render -------------------------------------------------------------
  return (
    <div className="flex min-w-0 flex-col rounded-md border border-slate-800 bg-slate-900 shadow-sm">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">
          {mode === "impact" ? "Impact analysis" : "Code knowledge graph"}
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {mode === "impact"
            ? "Select a symbol; affected code is highlighted by distance from the change."
            : "Files, functions and classes, linked by calls, imports and containment."}
        </p>
      </div>

      {/* Toolbar: search + count + view controls */}
      <div className="flex flex-col gap-2 border-b border-slate-800 p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={query}
            disabled={!hasGraph}
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestOpen(true);
              setActiveIdx(0);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setSuggestOpen(false)}
            onKeyDown={onSearchKey}
            placeholder="Search by symbol ID, name or type…"
            aria-label="Search graph nodes"
            className="w-full rounded-md border border-slate-700 bg-slate-950 py-2 pl-8 pr-8 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none disabled:opacity-50"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQuery("")}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {suggestOpen && suggestions.length > 0 && (
            <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-700 bg-slate-950 py-1 shadow-xl">
              {suggestions.map((n, i) => (
                <li
                  key={n.id}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSuggestion(n);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${i === activeIdx ? "bg-slate-800" : ""}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: nodeColor(n.type) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-slate-100">{n.label}</span>
                    <span className="block truncate font-mono text-[10px] text-slate-500">{n.id}</span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase text-slate-500">{n.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <p className="text-xs text-slate-400" aria-live="polite">
            {!hasGraph
              ? "No graph"
              : searching
                ? noMatches
                  ? "No matches"
                  : `${(matchedNodes?.length ?? 0).toLocaleString()} of ${graph!.nodes.length.toLocaleString()} nodes`
                : `${graph!.nodes.length.toLocaleString()} nodes · ${graph!.edges.length.toLocaleString()} edges`}
          </p>
          <div className="flex items-center overflow-hidden rounded-md border border-slate-700">
            {[
              { label: "Zoom in", icon: ZoomIn, run: () => zoomBy(1.3) },
              { label: "Zoom out", icon: ZoomOut, run: () => zoomBy(1 / 1.3) },
              { label: "Fit to screen", icon: Maximize2, run: () => cyRef.current?.fit(undefined, 30) },
              { label: "Re-run layout", icon: Network, run: () => runLayout.current() },
            ].map(({ label, icon: Icon, run }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                title={label}
                disabled={!hasGraph}
                onClick={run}
                className="border-r border-slate-700 bg-slate-950 p-1.5 text-slate-400 transition-colors last:border-r-0 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas + states */}
      <div className="relative h-[460px] bg-slate-950 lg:h-[600px]">
        {/* Cytoscape forces position:relative on its container, so size it explicitly instead of absolutely. */}
        {hasGraph && <div ref={containerRef} className="h-full w-full" />}

        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/90 text-xs text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
            Loading code knowledge graph…
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
            <div>
              <p className="text-sm font-medium text-slate-200">Couldn&apos;t load the graph</p>
              <p className="mt-1 max-w-md break-words text-xs text-slate-500">{error}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {!loading && !error && !hasGraph && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Network className="h-6 w-6 text-slate-600" />
            <div>
              <p className="text-sm font-medium text-slate-200">The knowledge graph is empty</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Scan and index a repository to populate files, functions, classes and their relationships.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onOpenScanner} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500">
                Scan a repository
              </button>
              <button type="button" onClick={onRetry} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                <RefreshCw className="h-3.5 w-3.5" /> Reload
              </button>
            </div>
          </div>
        )}

        {hasGraph && noMatches && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
            No nodes match &ldquo;{query.trim()}&rdquo;
          </div>
        )}
      </div>

      {/* Legend + type filters */}
      {hasGraph && (
        <div className="space-y-2 border-t border-slate-800 px-3 py-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-slate-500">Node types</span>
            {typeCounts.map(([type, count]) => {
              const off = hiddenTypes.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  aria-pressed={!off}
                  title={off ? "Show" : "Hide"}
                  className={`flex items-center gap-1.5 rounded border px-2 py-0.5 transition-colors ${
                    off ? "border-slate-800 text-slate-600 line-through" : "border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: off ? "#d3c9b4" : nodeColor(type) }} />
                  {type} <span className="text-slate-500">{count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500">
            <span>Edges</span>
            {relCounts.map(([rel, count]) => (
              <span key={rel} className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: EDGE_COLORS[rel] ?? DEFAULT_EDGE_COLOR, borderTopStyle: rel === "imports" ? "dashed" : rel === "contains" ? "dotted" : "solid" }} />
                {rel} {count.toLocaleString()}
              </span>
            ))}
            {graph!.skippedEdges > 0 && (
              <span className="text-amber-400/80">{graph!.skippedEdges.toLocaleString()} edges skipped (missing endpoint)</span>
            )}
            {mode === "impact" && impactDepths && (
              <span className="ml-auto flex items-center gap-2">
                Impact depth
                {IMPACT_COLORS.map((c, i) => (
                  <span key={c} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: impactColor(i + 1) }} />
                    {i + 1}{i === IMPACT_COLORS.length - 1 ? "+" : ""}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
