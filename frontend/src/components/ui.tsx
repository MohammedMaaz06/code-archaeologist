import React from "react";

/** Small presentational primitives shared by the dashboard views. */

export function Panel({
  title, subtitle, actions, children, className = "", bodyClassName = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`min-w-0 rounded-md border border-slate-800 bg-slate-900 shadow-sm ${className}`}>
      {title && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Kpi({
  label, value, hint, icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-800 bg-slate-900 px-4 py-3.5 shadow-sm">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-slate-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-0.5 truncate font-mono text-xl font-semibold tabular-nums text-slate-100">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function StackedBar({ segments, className = "" }: { segments: Segment[]; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-full bg-slate-800 ${className}`} role="img" aria-label="Distribution">
      {segments.map((s) => (
        <div
          key={s.label}
          title={`${s.label}: ${s.value.toLocaleString()}`}
          style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
        />
      ))}
    </div>
  );
}

export function MeterRow({
  label, value, max, color, right,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  color: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-slate-300">{label}</span>
        <span className="shrink-0 font-mono tabular-nums text-slate-400">{right ?? value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{children}</kbd>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800 ${className}`} />;
}
