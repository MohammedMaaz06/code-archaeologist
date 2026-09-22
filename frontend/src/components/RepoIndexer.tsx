"use client";

import React, { useState, useRef } from "react";
import { api, IndexRepoResponse } from "@/lib/api";

interface ProgressMessage {
  type: string;
  current_file?: string;
  files_processed?: number;
  total_files?: number;
  status?: string;
}

export default function RepoIndexer() {
  const [repoPath, setRepoPath] = useState<string>(".");
  const [chunkSize, setChunkSize] = useState<number>(500);
  const [chunkOverlap, setChunkOverlap] = useState<number>(50);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(["py", "ts", "tsx", "js"]);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [result, setResult] = useState<IndexRepoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  const availableExtensions = ["py", "ts", "tsx", "js", "go", "rs", "java", "md"];

  const toggleExtension = (ext: string) => {
    setSelectedExtensions((prev) =>
      prev.includes(ext) ? prev.filter((item) => item !== ext) : [...prev, ext]
    );
  };

  const startWebSocket = () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/index-progress";
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data: ProgressMessage = JSON.parse(event.data);
        if (data.type === "PROGRESS") {
          if (data.current_file) setCurrentFile(data.current_file);
          if (data.status) {
            setProgressLogs((prev) => [...prev.slice(-49), data.status!]);
          }
          if (data.files_processed && data.total_files && data.total_files > 0) {
            const pct = Math.round((data.files_processed / data.total_files) * 100);
            setProgressPercentage(pct);
          }
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    wsRef.current = ws;
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim()) return;

    setIsIndexing(true);
    setError(null);
    setResult(null);
    setProgressLogs([]);
    setCurrentFile(null);
    setProgressPercentage(0);

    startWebSocket();

    try {
      const res = await api.indexRepo({
        repo_path: repoPath,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        file_extensions: selectedExtensions.map((e) => `.${e}`),
      });
      setResult(res);
      setProgressPercentage(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed.");
    } finally {
      setIsIndexing(false);
      closeWebSocket();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-6 space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
          <span>⚡</span> Repository Vector Indexer
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Parse source code files, extract symbols via AST, and stream vector search embeddings in real-time.
        </p>
      </div>

      <form onSubmit={handleIndex} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Local Repository Path or Directory
          </label>
          <input
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="e.g. . or /path/to/repository"
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Chunk Size (Tokens)
            </label>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              min={100}
              max={2000}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Chunk Overlap
            </label>
            <input
              type="number"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
              min={0}
              max={500}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            File Extensions to Index
          </label>
          <div className="flex flex-wrap gap-2">
            {availableExtensions.map((ext) => {
              const active = selectedExtensions.includes(ext);
              return (
                <button
                  type="button"
                  key={ext}
                  onClick={() => toggleExtension(ext)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-mono transition-colors ${
                    active
                      ? "bg-blue-600/20 border-blue-500/80 text-blue-300 font-bold"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  .{ext}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isIndexing}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isIndexing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Indexing Repository...
            </>
          ) : (
            "Start Real-Time Repository Indexing"
          )}
        </button>
      </form>

      {isIndexing && (
        <div className="space-y-3 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Processing: <strong className="text-blue-400">{currentFile || "Scanning files..."}</strong>
            </span>
            <span className="font-bold text-slate-200">{progressPercentage}%</span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded p-3 h-32 overflow-y-auto space-y-1 text-[11px] text-slate-400">
            {progressLogs.length === 0 && <span className="text-slate-600">Waiting for indexing events...</span>}
            {progressLogs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-slate-600 select-none">&gt;</span>
                <span className="text-slate-300">{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-lg">
          <strong>Indexing Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 rounded-lg space-y-2 text-xs">
          <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <span>✓</span> Indexing Completed Successfully!
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-800/40 text-center">
            <div>
              <div className="text-lg font-extrabold text-emerald-300">{result.indexed_files}</div>
              <div className="text-[11px] text-emerald-400/80">Files Processed</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-emerald-300">{result.total_chunks}</div>
              <div className="text-[11px] text-emerald-400/80">Vector Chunks</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-emerald-300">{result.total_symbols}</div>
              <div className="text-[11px] text-emerald-400/80">Symbols Identified</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
