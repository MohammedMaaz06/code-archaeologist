import type { BlastRadiusResult, GraphNode } from "@/lib/api";
import { fileOf } from "@/lib/graphAnalytics";

interface ReportInput {
  result: BlastRadiusResult;
  depth: number;
  nodesById: Map<string, GraphNode>;
}

const rows = ({ result, nodesById }: ReportInput) =>
  [...result.affected]
    .sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99) || a.id.localeCompare(b.id))
    .map((a) => {
      const n = nodesById.get(a.id);
      return { id: a.id, name: n?.label ?? a.id, type: n?.type ?? "unknown", file: (n && fileOf(n)) ?? "", depth: a.depth ?? null };
    });

export function buildImpactJson(input: ReportInput): string {
  const root = input.nodesById.get(input.result.symbolId);
  return JSON.stringify(
    {
      symbol: { id: input.result.symbolId, name: root?.label ?? input.result.symbolId, type: root?.type ?? "unknown" },
      maxDepth: input.depth,
      totalImpacted: input.result.totalImpacted,
      generatedAt: new Date().toISOString(),
      affected: rows(input),
    },
    null,
    2
  );
}

export function buildImpactMarkdown(input: ReportInput): string {
  const { result, depth, nodesById } = input;
  const root = nodesById.get(result.symbolId);
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    `# Blast radius: ${root?.label ?? result.symbolId}`,
    "",
    `- **Symbol ID:** \`${result.symbolId}\``,
    `- **Type:** ${root?.type ?? "unknown"}`,
    `- **Max depth:** ${depth}`,
    `- **Total impacted:** ${result.totalImpacted}`,
    `- **Generated:** ${new Date().toISOString()}`,
    "",
  ];
  if (result.totalImpacted === 0) {
    lines.push("Nothing else depends on this symbol within the selected depth.");
  } else {
    lines.push("| Depth | Name | Type | File | Symbol ID |", "| ---: | --- | --- | --- | --- |");
    for (const r of rows(input)) {
      lines.push(`| ${r.depth ?? "-"} | ${esc(r.name)} | ${r.type} | ${esc(r.file || "-")} | \`${esc(r.id)}\` |`);
    }
  }
  return lines.join("\n") + "\n";
}

export function reportFileName(label: string, depth: number, ext: "json" | "md"): string {
  const slug = label.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "symbol";
  return `impact-${slug}-depth${depth}.${ext}`;
}

export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
