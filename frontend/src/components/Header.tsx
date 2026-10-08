"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, ExternalLink, RefreshCw, ScanSearch, Search } from "lucide-react";
import { api, API_ORIGIN } from "@/lib/api";

type Health = "checking" | "online" | "degraded" | "offline";

const HEALTH_STYLE: Record<Health, { dot: string; text: string; label: string }> = {
  checking: { dot: "bg-slate-500", text: "text-slate-400", label: "Checking" },
  online: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Backend online" },
  degraded: { dot: "bg-amber-400", text: "text-amber-300", label: "Backend degraded" },
  offline: { dot: "bg-rose-500", text: "text-rose-300", label: "Backend offline" },
};

const HEALTH_POLL_MS = 30_000;

interface HeaderProps {
  scannerOpen: boolean;
  onToggleScanner: () => void;
  onOpenPalette: () => void;
}

export default function Header({ scannerOpen, onToggleScanner, onOpenPalette }: HeaderProps) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  const [health, setHealth] = useState<Health>("checking");
  const [detail, setDetail] = useState<string>("");
  const controllerRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setHealth((prev) => (prev === "online" ? prev : "checking"));
    try {
      const data = await api.getHealth(controller.signal);
      const ok = ["ok", "healthy", "up"].includes(String(data.status).toLowerCase());
      setHealth(ok ? "online" : "degraded");
      setDetail(`status: ${data.status}`);
    } catch (err) {
      if (controller.signal.aborted) return;
      setHealth("offline");
      setDetail(err instanceof Error ? err.message : "Request failed");
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, HEALTH_POLL_MS);
    return () => {
      clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [check]);

  const style = HEALTH_STYLE[health];
  const host = (() => {
    try {
      return new URL(API_ORIGIN).host;
    } catch {
      return API_ORIGIN;
    }
  })();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-50">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-slate-100 sm:text-[15px]">Code Archaeologist</h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">Codebase intelligence &amp; impact analysis</p>
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
            <kbd className="hidden rounded border border-slate-700 bg-slate-950 px-1.5 font-mono text-[10px] lg:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
          </button>

          <button
            type="button"
            onClick={check}
            title={detail ? `${detail}\nClick to re-check` : "Click to re-check"}
            className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs transition-colors hover:border-slate-700 sm:px-2.5"
          >
            <span className={`h-2 w-2 rounded-full ${style.dot} ${health === "checking" ? "animate-pulse" : ""}`} />
            <span className={`${style.text} hidden sm:inline`}>{style.label}</span>
            <span className="hidden font-mono text-slate-500 lg:inline">{host}</span>
            <RefreshCw className="hidden h-3 w-3 text-slate-500 sm:block" />
          </button>

          <a
            href={`${API_ORIGIN}/docs`}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-100 md:flex"
          >
            API docs <ExternalLink className="h-3 w-3" />
          </a>

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
            {scannerOpen ? "Close scan" : (<><span className="hidden sm:inline">New </span>Scan</>)}
          </button>
        </div>
      </div>
    </header>
  );
}
