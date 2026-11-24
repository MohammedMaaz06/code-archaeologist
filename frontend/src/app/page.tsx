"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import Header from "@/components/Header";
import Sidebar, { MobileNav, VIEW_META, type View } from "@/components/Sidebar";
import RepositoryPanel, { type Analysis } from "@/components/RepositoryPanel";
import RepoSummaryBar from "@/components/RepoSummaryBar";
import OverviewView from "@/components/OverviewView";
import type { FocusRequest } from "@/components/GraphExplorer";
import NodeInspector from "@/components/NodeInspector";
import ImpactPanel from "@/components/ImpactPanel";
import CodeExplanationView from "@/components/CodeExplanationView";
import StartupLoader from "@/components/StartupLoader";
import { api, languageFromPath, type GraphNode } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

const GraphExplorer = dynamic(() => import("@/components/GraphExplorer"), {
  loading: () => <div className="graph-loading-placeholder" aria-label="Loading graph tools" />,
  ssr: false,
});
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), {
  ssr: false,
});

const LAST_REPOSITORY_KEY = "code-archaeologist:last-repository-path";

export default function Home() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [view, setView] = useState<View>("overview");
  // The graph canvas is mounted on first visit and then kept (hidden) so zoom/layout survive view switches.
  const [graphVisited, setGraphVisited] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [depth, setDepth] = useState(3);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const graph = useApiResource((signal) => api.exportGraph(signal), []);
  const reloadGraph = graph.reload;

  // Blast radius is fetched only while the Impact view is active and a symbol is selected.
  const blast = useApiResource(
    view === "impact" && selectedId ? (signal) => api.getBlastRadius(selectedId, depth, signal) : null,
    [view, selectedId, depth]
  );

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    graph.data?.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graph.data]);

  const selectedNode = selectedId ? nodesById.get(selectedId) ?? null : null;

  // Backends that omit depth_map still highlight affected nodes (treated as depth 1).
  const impactDepths = useMemo(() => {
    if (!blast.data || blast.data.symbolId !== selectedId) return null;
    return new Map(blast.data.affected.map((a) => [a.id, a.depth && a.depth > 0 ? a.depth : 1]));
  }, [blast.data, selectedId]);

  const go = useCallback((next: View) => {
    setView(next);
    if (next !== "overview" && next !== "explain") setGraphVisited(true);
  }, []);

  const focusNode = useCallback((id: string) => setFocusRequest({ id, nonce: Date.now() }), []);

  const openSymbol = useCallback(
    (id: string, target: "graph" | "impact") => {
      setSelectedId(id);
      focusNode(id);
      go(target);
    },
    [focusNode, go]
  );

  const openScanner = useCallback(() => {
    setScannerOpen(true);
    go("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [go]);

  const handleAnalyzed = useCallback(
    (result: Analysis) => {
      setAnalysis(result);
      setScannerOpen(false);
      setSelectedId(null);

      const repositoryPath = result.repo?.path;
      if (repositoryPath && typeof window !== "undefined") {
        window.localStorage.setItem(LAST_REPOSITORY_KEY, repositoryPath);
      }

      reloadGraph();
    },
    [reloadGraph]
  );

  // Restore the last scanned repository after a browser reload/reopen.
  useEffect(() => {
    const savedPath = window.localStorage.getItem(LAST_REPOSITORY_KEY)?.trim();
    if (!savedPath) return;

    let cancelled = false;
    const controller = new AbortController();

    const restoreRepository = async () => {
      try {
        const repo = await api.scanRepository(savedPath, controller.signal);
        if (cancelled) return;

        const indexable = repo.files.flatMap((file) =>
          typeof file.source_code === "string" && file.source_code.length > 0
            ? [{
                file_path: file.file_path,
                source_code: file.source_code,
                language: file.language ?? languageFromPath(file.file_path),
              }]
            : []
        );

        if (indexable.length === 0) {
          handleAnalyzed({
            repo,
            index: null,
            indexNote: "Repository restored, but no source contents were available to rebuild the search index. Rescan the repository.",
            indexFailed: true,
          });
          return;
        }

        try {
          const index = await api.indexFiles(indexable, controller.signal, repo.path);
          if (cancelled) return;
          handleAnalyzed({
            repo,
            index,
            indexNote: "Repository restored and its search index was rebuilt.",
            indexFailed: false,
          });
        } catch (err) {
          if (cancelled) return;
          handleAnalyzed({
            repo,
            index: null,
            indexNote: `Repository restored, but rebuilding its search index failed: ${err instanceof Error ? err.message : "unknown error"}`,
            indexFailed: true,
          });
        }
      } catch {
        // Keep the dashboard usable when the previously scanned repository
        // no longer exists or the backend is temporarily unavailable.
      }
    };

    void restoreRepository();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadGraph, handleAnalyzed]);

  // Ctrl/Cmd+K opens the symbol finder from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const badges = useMemo(
    () => ({
      graph: graph.data ? graph.data.nodes.length.toLocaleString() : undefined,
      impact: view === "impact" && blast.data && blast.data.symbolId === selectedId ? blast.data.totalImpacted.toLocaleString() : undefined,
    }),
    [graph.data, view, blast.data, selectedId]
  );

  const onWorkspace = view !== "overview" && view !== "explain";

  return (
    <div className="app-shell min-h-screen bg-slate-950 text-slate-100">
      <Header
        className="dashboard-start-header"
        scannerOpen={scannerOpen}
        repositoryName={analysis?.repo.name}
        repositoryIndexed={Boolean(analysis?.index && !analysis.indexFailed)}
        onToggleScanner={() => (scannerOpen ? setScannerOpen(false) : openScanner())}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <div className="dashboard-layout lg:flex">
        <Sidebar
          className="dashboard-start-sidebar"
          view={view}
          onChange={go}
          badges={badges}
          selected={selectedNode}
          selectedId={selectedId}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main className="dashboard-main dashboard-start-main min-w-0 flex-1 space-y-5">
          <MobileNav view={view} onChange={go} badges={badges} />

          {view === "overview" ? (
            <section className="dashboard-hero dashboard-view-enter">
              <div className="page-heading-copy">
                <p className="page-eyebrow">
                  <span className="hero-eyebrow-dot" />
                  CODEBASE INTELLIGENCE
                  <span className="hero-eyebrow-divider">/</span>
                  OVERVIEW
                </p>
                <h2 className="page-title">
                  {analysis ? `Inside ${analysis.repo.name}` : <>Your codebase,<br />in focus.</>}
                </h2>
                <p className="page-description">
                  {analysis
                    ? "A living map of your files, symbols, and the connections that shape your system."
                    : "Map the structure behind your software. Trace relationships, surface hotspots, and see the impact of change."}
                </p>
                <div className="hero-actions">
                  <button type="button" onClick={openScanner} className="hero-primary-action">
                    {analysis ? "Scan another repository" : "Start a repository scan"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="hero-action-note">Local folder or public Git URL</span>
                </div>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="hero-visual-grid" />
                <svg className="hero-graph-art" viewBox="0 0 300 230" fill="none">
                  <path d="M65 56 137 92 222 49M65 56l19 99 53-63 43 93 42-40M137 92l44-3 41 40" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
                  <path d="m84 155 95 26 43-52M137 92l44-3" stroke="currentColor" strokeOpacity=".18" strokeWidth="1" strokeDasharray="3 5" />
                  <circle cx="65" cy="56" r="6" fill="#D8A875" />
                  <circle cx="137" cy="92" r="9" fill="#F4F2E8" />
                  <circle cx="222" cy="49" r="5" fill="#94B89A" />
                  <circle cx="84" cy="155" r="5" fill="#94B89A" />
                  <circle cx="179" cy="181" r="7" fill="#D8A875" />
                  <circle cx="224" cy="141" r="9" fill="#F4F2E8" />
                  <circle cx="181" cy="89" r="4" fill="#94B89A" />
                  <circle cx="137" cy="92" r="15" stroke="white" strokeOpacity=".18" />
                  <circle cx="224" cy="141" r="16" stroke="white" strokeOpacity=".14" />
                </svg>
                <div className="hero-visual-caption">
                  <span className="hero-visual-pulse" />
                  <span>{analysis ? "Repository map ready" : "Ready to map your code"}</span>
                </div>
                <div className="hero-visual-brand"><BrandMark className="hero-brand-mark" /></div>
              </div>
              {analysis && (
                <div className="hero-status">
                  <span className={`hero-status-dot ${analysis.index && !analysis.indexFailed ? "is-ready" : "is-pending"}`} />
                  {analysis.index && !analysis.indexFailed ? "INDEX UP TO DATE" : "REPOSITORY SCANNED"}
                </div>
              )}
            </section>
          ) : (
            <section className="workspace-heading dashboard-view-enter">
              <div className="workspace-heading-copy">
                <p className="workspace-heading-eyebrow">
                  <span className="hero-eyebrow-dot" />
                  {analysis?.repo.name ?? "CODEBASE WORKSPACE"}
                  <span className="hero-eyebrow-divider">/</span>
                  {view === "graph" ? "SYSTEM MAP" : view === "impact" ? "CHANGE ANALYSIS" : "CODE INSIGHTS"}
                </p>
                <h2>{VIEW_META[view].label}</h2>
                <p>{VIEW_META[view].description}</p>
              </div>
              {view !== "explain" && (
                <div className="workspace-heading-count">
                  <span className="workspace-count-icon"><BrandMark className="workspace-count-mark" /></span>
                  <span><strong>{graph.data?.nodes.length.toLocaleString() ?? "—"}</strong><small>GRAPH NODES</small></span>
                  <span className="workspace-count-divider" />
                  <span><strong>{graph.data?.edges.length.toLocaleString() ?? "—"}</strong><small>RELATIONSHIPS</small></span>
                </div>
              )}
            </section>
          )}

          {/* Kept mounted (hidden outside Overview) so an in-flight scan is never aborted by navigating. */}
          <div className={`overview-repository-stage ${view === "overview" ? "block" : "hidden"}`}>
            <RepositoryPanel
              analysis={analysis}
              graph={graph.data}
              scannerOpen={scannerOpen}
              onAnalyzed={handleAnalyzed}
              onClose={() => setScannerOpen(false)}
            />
          </div>

          {view === "overview" && (
            <OverviewView
              graph={graph.data}
              loading={graph.loading}
              error={graph.error}
              onRetry={graph.reload}
              onScan={openScanner}
              onOpenSymbol={openSymbol}
            />
          )}

          {view === "explain" && (
            <CodeExplanationView
              repositoryPath={analysis?.repo.path}
              repositoryName={analysis?.repo.name}
            />
          )}

          {onWorkspace && <RepoSummaryBar analysis={analysis} onScan={openScanner} />}

          {graphVisited && (
            <div className={`workspace-graph-stage grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] ${onWorkspace ? "" : "hidden"}`}>
              <GraphExplorer
                graph={graph.data}
                loading={graph.loading}
                error={graph.error}
                onRetry={graph.reload}
                onOpenScanner={openScanner}
                selectedId={selectedId}
                onSelect={setSelectedId}
                mode={view === "impact" ? "impact" : "graph"}
                impactDepths={impactDepths}
                focusRequest={focusRequest}
                visible={onWorkspace}
              />

              <aside
                aria-label={view === "impact" ? "Impact analysis" : "Symbol inspector"}
                className="inspector-panel max-h-[640px] min-h-[200px] overflow-y-auto rounded-md border border-slate-800 bg-slate-900 shadow-sm xl:h-[calc(600px+12rem)] xl:max-h-none"
              >
                {view === "impact" ? (
                  <ImpactPanel
                    node={selectedNode}
                    selectedId={selectedId}
                    depth={depth}
                    onDepthChange={setDepth}
                    loading={blast.loading}
                    error={blast.error}
                    result={blast.data}
                    nodesById={nodesById}
                    totalNodes={graph.data?.nodes.length ?? 0}
                    onRetry={blast.reload}
                    onFocusNode={focusNode}
                  />
                ) : (
                  <NodeInspector
                    graph={graph.data}
                    node={selectedNode}
                    selectedId={selectedId}
                    nodesById={nodesById}
                    onNavigate={(id) => openSymbol(id, "graph")}
                    onAnalyzeImpact={() => go("impact")}
                  />
                )}
              </aside>
            </div>
          )}
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette
          open
          nodes={graph.data?.nodes ?? []}
          onClose={() => setPaletteOpen(false)}
          onPick={(id, target) => {
            setPaletteOpen(false);
            openSymbol(id, target);
          }}
        />
      )}
      <StartupLoader />
    </div>
  );
}
