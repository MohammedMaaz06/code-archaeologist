"use client";

import React, { useState, useEffect } from "react";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import ArcheologySearch from "@/components/ArcheologySearch";
import RepoIndexer from "@/components/RepoIndexer";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"search" | "graph" | "indexer">("search");
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "checking">("checking");

  useEffect(() => {
    api.getHealth()
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-500/20">
            CA
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-base leading-tight">Code Archaeologist</h1>
            <p className="text-[11px] text-slate-400 font-mono">v1.2.0 • AST & Vector Intelligence</p>
          </div>
        </div>

        {/* System Health Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                apiStatus === "online"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : apiStatus === "offline"
                  ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                  : "bg-amber-400 animate-pulse"
              }`}
            ></span>
            <span className="text-slate-300 capitalize">{apiStatus}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Semantic Search</p>
              <p className="text-xl font-bold text-slate-100 mt-1">Vector Search Engine</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg font-mono text-xs border border-blue-500/20">Qdrant</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Graph Topology</p>
              <p className="text-xl font-bold text-slate-100 mt-1">AST Dependency Graph</p>
            </div>
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg font-mono text-xs border border-purple-500/20">Cytoscape</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">AI Assistant</p>
              <p className="text-xl font-bold text-slate-100 mt-1">LLM Synthesis</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg font-mono text-xs border border-emerald-500/20">Active</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "search"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            🔍 Archeology Search
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "graph"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            🕸️ Knowledge Graph
          </button>
          <button
            onClick={() => setActiveTab("indexer")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "indexer"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            ⚡ Repository Indexer
          </button>
        </div>

        {/* Tab Panels */}
        <div className="space-y-6">
          {activeTab === "search" && <ArcheologySearch />}
          {activeTab === "graph" && <KnowledgeGraph />}
          {activeTab === "indexer" && <RepoIndexer />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        Code Archaeologist • Built with Next.js, FastAPI, Cytoscape.js & Qdrant
      </footer>
    </div>
  );
}
