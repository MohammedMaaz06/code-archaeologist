'use client';

import React, { useState, useEffect } from "react";
import RepoIndexer from "@/components/RepoIndexer";
import ASTDependencyGraph from "@/components/ASTDependencyGraph";
import { api, IndexRepoResponse } from "@/lib/api";
import { 
  Activity, 
  GitBranch, 
  Search, 
  FileCode2, 
  Cpu, 
  Terminal, 
  ShieldCheck, 
  ArrowUpRight 
} from "lucide-react";

export default function Home() {
  const [healthStatus, setHealthStatus] = useState<string>("Checking...");
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [showGraph, setShowGraph] = useState<boolean>(false);
  const [indexStats, setIndexStats] = useState<IndexRepoResponse | null>(null);

  useEffect(() => {
    api.getHealth()
      .then((data) => setHealthStatus(data.status === "ok" || data.status === "healthy" ? "Healthy" : "Degraded"))
      .catch(() => setHealthStatus("Offline"));
  }, []);

  const stats = [
    {
      label: "Files Indexed",
      value: indexStats ? indexStats.indexed_files.toLocaleString() : "?",
      change: indexStats ? "Latest scan" : "Run a repository scan",
      icon: GitBranch,
      color: "from-blue-500 to-cyan-400",
    },
    {
      label: "Symbols Extracted",
      value: indexStats ? indexStats.total_symbols.toLocaleString() : "?",
      change: indexStats ? "Latest scan" : "Waiting for scan",
      icon: FileCode2,
      color: "from-indigo-500 to-purple-400",
    },
    {
      label: "Chunks Generated",
      value: indexStats ? indexStats.total_chunks.toLocaleString() : "?",
      change: indexStats ? "Latest scan" : "Waiting for scan",
      icon: Activity,
      color: "from-emerald-500 to-teal-400",
    },
    {
      label: "Index Status",
      value: indexStats ? indexStats.status : "Idle",
      change: indexStats ? "Latest scan completed" : "No scan yet",
      icon: Cpu,
      color: "from-amber-500 to-orange-400",
    },
  ];

  const quickActions = [
    { title: "Repository Scanner", desc: "Scan physical repo path & build symbol index.", tag: "POST /repositories/scan", icon: Search },
    { title: "Dependency Graph", desc: "Visualize cross-file imports & symbol dependencies.", tag: "POST /graph/build", icon: GitBranch },
    { title: "Impact Analysis", desc: "Calculate blast radius before refactoring codebase.", tag: "GET /graph/blast-radius", icon: ShieldCheck },
    { title: "LLM Code Archeology", desc: "Query repository history with AI assistant.", tag: "POST /llm/explain", icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Bar Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-8 mb-8 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${healthStatus === 'Healthy' ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]' : 'bg-amber-400'} animate-pulse`} />
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Code Archaeologist
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Backend API Status: <span className={healthStatus === 'Healthy' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>{healthStatus}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm font-medium rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm">
            Docs
          </button>
          <button
            onClick={() => setShowScanner((prev) => !prev)}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            {showScanner ? "Close Scanner" : "+ New Scan"}
          </button>
        </div>
      </header>

      {showGraph && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-200">
                Dependency Graph
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Explore relationships discovered by the code analysis pipeline.
              </p>
            </div>

            <button
              onClick={() => setShowGraph(false)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>

          <ASTDependencyGraph />
        </section>
      )}

      {showScanner && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-200">
                Repository Analysis
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Analyze a repository and build its code intelligence index.
              </p>
            </div>
          </div>

          <RepoIndexer onIndexed={(result) => setIndexStats(result)} />
        </section>
      )}

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div 
              key={idx}
              className="relative group p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 shadow-md hover:shadow-xl hover:shadow-indigo-500/5 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">{stat.label}</span>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight mb-1">{stat.value}</div>
              <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span>{stat.change}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Quick Action Cards Grid */}
      <section>
        <h2 className="text-lg font-bold text-slate-200 mb-5 flex items-center gap-2">
          <span>Engine Workflows</span>
          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">v1.0</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <div
                key={idx}
                onClick={() => {
                  if (action.title === "Repository Scanner") {
                    setShowScanner(true);
                    setShowGraph(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }

                  if (action.title === "Dependency Graph") {
                    setShowGraph(true);
                    setShowScanner(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="group relative p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-indigo-500/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-xl bg-slate-800/80 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <h3 className="text-base font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-slate-400 mt-1 mb-4 leading-relaxed">
                  {action.desc}
                </p>
                <span className="inline-block px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                  {action.tag}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}