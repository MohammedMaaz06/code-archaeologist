"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Sidebar, { MobileNav, VIEW_META, type View } from "@/components/Sidebar";
import RepositoryPanel, { type Analysis } from "@/components/RepositoryPanel";
import RepoSummaryBar from "@/components/RepoSummaryBar";
import OverviewView from "@/components/OverviewView";
import GraphExplorer, { type FocusRequest } from "@/components/GraphExplorer";
import NodeInspector from "@/components/NodeInspector";
import ImpactPanel from "@/components/ImpactPanel";
import CodeExplanationView from "@/components/CodeExplanationView";
import CommandPalette from "@/components/CommandPalette";
import { api, languageFromPath, type GraphNode } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        scannerOpen={scannerOpen}
        onToggleScanner={() => (scannerOpen ? setScannerOpen(false) : openScanner())}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <div className="lg:flex">
        <Sidebar
          view={view}
          onChange={go}
          badges={badges}
          selected={selectedNode}
          selectedId={selectedId}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6 lg:py-6">
          <MobileNav view={view} onChange={go} badges={badges} />

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{analysis?.repo.name ?? "Workspace"}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-300">{VIEW_META[view].label}</span>
            <span className="hidden text-slate-500 sm:inline">· {VIEW_META[view].description}</span>
          </nav>

          {/* Kept mounted (hidden outside Overview) so an in-flight scan is never aborted by navigating. */}
          <div className={view === "overview" ? "block" : "hidden"}>
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
            <div className={onWorkspace ? "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : "hidden"}>
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
                className="max-h-[640px] min-h-[200px] overflow-y-auto rounded-md border border-slate-800 bg-slate-900 shadow-sm xl:h-[calc(600px+12rem)] xl:max-h-none"
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

      <CommandPalette
        open={paletteOpen}
        nodes={graph.data?.nodes ?? []}
        onClose={() => setPaletteOpen(false)}
        onPick={(id, target) => {
          setPaletteOpen(false);
          openSymbol(id, target);
        }}
      />
    </div>
  );
}
