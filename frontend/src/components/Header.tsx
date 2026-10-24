"use client";

import React, { useEffect, useState } from "react";
import { Boxes, ScanSearch, Search } from "lucide-react";

interface HeaderProps {
  scannerOpen: boolean;
  onToggleScanner: () => void;
  onOpenPalette: () => void;
}

export default function Header({ scannerOpen, onToggleScanner, onOpenPalette }: HeaderProps) {
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-950">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-slate-100 sm:text-[15px]">
              Code Archaeologist
            </h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Codebase intelligence &amp; impact analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Find a symbol"
            className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Find a symbol</span>
            <kbd className="hidden rounded border border-slate-700 bg-slate-950 px-1.5 font-mono text-[10px] lg:inline">
              {mac ? "âŒ˜K" : "Ctrl K"}
            </kbd>
          </button>

          <button
            type="button"
            onClick={onToggleScanner}
            aria-pressed={scannerOpen}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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
