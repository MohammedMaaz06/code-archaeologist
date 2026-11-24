"use client";

import React, { useEffect, useState } from "react";
import { FolderGit2, ScanSearch, Search } from "lucide-react";
import BrandMark from "@/components/BrandMark";

interface HeaderProps {
  className?: string;
  scannerOpen: boolean;
  repositoryName?: string;
  repositoryIndexed: boolean;
  onToggleScanner: () => void;
  onOpenPalette: () => void;
}

export default function Header({
  className = "",
  scannerOpen,
  repositoryName,
  repositoryIndexed,
  onToggleScanner,
  onOpenPalette,
}: HeaderProps) {
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  return (
    <header className={`dashboard-header sticky top-0 z-30 border-b ${className}`}>
      <div className="dashboard-header-inner flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="brand-mark flex items-center justify-center">
            <BrandMark className="brand-mark-art" />
          </div>
          <div className="min-w-0">
            <h1 className="brand-title whitespace-nowrap font-semibold text-slate-100">Code Archaeologist</h1>
            <p className="brand-caption">CODEBASE INTELLIGENCE WORKSPACE</p>
          </div>
        </div>

        <div className="header-repository-context">
          <span className="header-repository-icon"><FolderGit2 className="h-4 w-4" /></span>
          <span className="header-repository-copy">
            <span className="header-repository-label">CURRENT REPOSITORY</span>
            <span className="header-repository-name">{repositoryName ?? "No repository selected"}</span>
          </span>
          <span className={`header-index-status ${repositoryIndexed ? "is-indexed" : ""}`}>
            <span />
            {repositoryName ? repositoryIndexed ? "Indexed" : "Scanned" : "Ready"}
          </span>
        </div>

        <div className="header-actions flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Find a symbol"
            className="header-search-button flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Find a symbol</span>
            <kbd className="hidden rounded border border-slate-700 bg-slate-950 px-1.5 font-mono text-[10px] lg:inline">
              {mac ? "⌘ K" : "Ctrl K"}
            </kbd>
          </button>

          <button
            type="button"
            onClick={onToggleScanner}
            aria-pressed={scannerOpen}
            className={`header-scan-button flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              scannerOpen
                ? "border border-slate-700 bg-slate-800 text-slate-100"
                : "bg-sky-600 text-white hover:bg-sky-500"
            }`}
          >
            <ScanSearch className="h-3.5 w-3.5" />
            {scannerOpen ? "Close scan" : <><span className="hidden sm:inline">New </span>Scan</>}
          </button>
        </div>
      </div>
    </header>
  );
}
