// Shared visual vocabulary for the graph canvas, legend and inspector (tuned for a beige canvas).

export const NODE_TYPE_COLORS: Record<string, string> = {
  file: "#5b8a6e",
  module: "#8a6fa8",
  class: "#c28a2e",
  function: "#3f7f9a",
  method: "#3a8f8f",
  variable: "#8a8272",
};
export const DEFAULT_NODE_COLOR = "#8a8272";

export const nodeColor = (type: string) => NODE_TYPE_COLORS[type] ?? DEFAULT_NODE_COLOR;

export const EDGE_COLORS: Record<string, string> = {
  calls: "#8a8068",
  imports: "#4a6a8a",
  contains: "#b8ad96",
  inherits: "#c28a2e",
};
export const DEFAULT_EDGE_COLOR = "#a39a88";

// Blast-radius depth buckets: closer to the changed symbol = hotter.
export const IMPACT_COLORS = ["#b5392f", "#d9772b", "#d4a72c", "#8fa43a"];
export const IMPACT_ROOT = "#b5392f";
export const impactColor = (depth: number | undefined) =>
  IMPACT_COLORS[Math.min(Math.max((depth ?? 1) - 1, 0), IMPACT_COLORS.length - 1)];
