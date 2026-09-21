"use client";

import React, { useState } from "react";
import { api, IndexRepoResponse } from "@/lib/api";

export default function RepoIndexer() {
  const [repoPath, setRepoPath] = useState<string>(".");
  const [chunkSize, setChunkSize] = useState<number>(500);
  const [chunkOverlap, setChunkOverlap] = useState<number>(50);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(["py", "ts", "tsx", "js"]);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [result, setResult] = useState<IndexRepoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableExtensions = ["py", "ts", "tsx", "js", "go", "rs", "java", "md"];

  const toggleExtension = (ext: string) => {
    setSelectedExtensions((prev) =>
      prev.includes(ext) ? prev.filter((item) => item !== ext) : [...prev, ext]
    );
  };

  const handleIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim()) return;

    setIsIndexing(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.indexRepo({
        repo_path: repoPath,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        file_extensions: selectedExtensions.map((e) => `.${e}`),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed.");
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
      <div className="border-b pb-3">
        <h3 className="font-bold text-slate-800 text-lg">Repository Vector Indexer</h3>
        <p className="text-xs text-slate-500">
          Parse source code files, extract symbols via AST, and populate vector search embeddings.
        </p>
      </div>

      <form onSubmit={handleIndex} className="space-y-4">
        {/* Repo Path Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Local Repository Path or Directory
          </label>
          <input
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="e.g. . or /path/to/repository"
            className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        {/* Chunking Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chunk Size (Tokens/Chars)
            </label>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              min={100}
              max={2000}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chunk Overlap
            </label>
            <input
              type="number"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
              min={0}
              max={500}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Extensions Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                      ? "bg-blue-50 border-blue-400 text-blue-700 font-bold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  .{ext}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={isIndexing}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isIndexing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Indexing Repository & Building Vectors...
            </>
          ) : (
            "Start Repository Indexing"
          )}
        </button>
      </form>

      {/* Error View */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          <strong>Indexing Error:</strong> {error}
        </div>
      )}

      {/* Result Metrics */}
      {result && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg space-y-2 text-xs">
          <div className="font-bold text-emerald-800 text-sm flex items-center gap-2">
            <span>✓</span> Indexing Completed Successfully!
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-200/60 text-center">
            <div>
              <div className="text-lg font-extrabold text-emerald-700">{result.indexed_files}</div>
              <div className="text-[11px] text-emerald-600">Files Processed</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-emerald-700">{result.total_chunks}</div>
              <div className="text-[11px] text-emerald-600">Vector Chunks</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-emerald-700">{result.total_symbols}</div>
              <div className="text-[11px] text-emerald-600">Symbols Identified</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
