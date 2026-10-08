// Centralized API client for the Code Archaeologist backend.
// Base URL comes from NEXT_PUBLIC_API_BASE_URL (see .env.example).

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

/** Backend origin without the /api/v1 suffix (used for the API docs link). */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, "");

// ---------------------------------------------------------------------------
// Errors + transport
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** FastAPI returns `detail` as a string or as a list of validation errors. */
function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => {
      if (d && typeof d === "object") {
        const item = d as { msg?: unknown; loc?: unknown };
        const loc = Array.isArray(item.loc) ? item.loc.filter((p) => p !== "body").join(".") : "";
        const msg = typeof item.msg === "string" ? item.msg : JSON.stringify(d);
        return loc ? `${loc}: ${msg}` : msg;
      }
      return String(d);
    });
    return parts.join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return null;
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE_URL}. Make sure it is running and allows requests from this origin (CORS).`
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = formatDetail((body as { detail?: unknown }).detail);
    throw new ApiError(detail || `HTTP ${res.status}: ${res.statusText}`, res.status);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Small parsing helpers (the backend payloads are normalized defensively)
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : undefined;
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const firstStr = (o: Rec, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = str(o[k]);
    if (v) return v;
  }
  return undefined;
};

function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

const EXT_LANGUAGE: Record<string, string> = {
  py: "python", ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  go: "go", rs: "rust", java: "java", rb: "ruby", c: "c", h: "c", cpp: "cpp", cs: "csharp", php: "php",
};

export function languageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANGUAGE[ext] ?? "text";
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Scan + index
// ---------------------------------------------------------------------------

export interface ScannedFile {
  file_path: string;
  language?: string;
  loc?: number;
  source_code?: string;
}

export interface ScanResult {
  id?: string;
  name: string;
  path: string;
  total_files: number;
  total_loc: number;
  files: ScannedFile[];
  /** Primitive git fields returned by the backend, when available. */
  git: Record<string, string | number | boolean> | null;
}

function normalizeScan(raw: unknown, requestedPath: string): ScanResult {
  if (!isRec(raw)) throw new ApiError("Unexpected response from /scan.");

  const files: ScannedFile[] = (Array.isArray(raw.files) ? raw.files : []).flatMap((f) => {
    if (typeof f === "string") return [{ file_path: f }];
    if (!isRec(f)) return [];
    const file_path = firstStr(f, ["file_path", "relative_path", "path"]);
    if (!file_path) return [];
    return [{
      file_path,
      language: str(f.language),
      loc: num(f.loc) ?? num(f.lines),
      source_code: typeof f.source_code === "string" ? f.source_code : undefined,
    }];
  });

  const path = str(raw.path) ?? requestedPath;
  const gitRaw = isRec(raw.git) ? raw.git : isRec(raw.git_info) ? raw.git_info : null;
  const git = gitRaw
    ? Object.fromEntries(
        Object.entries(gitRaw).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
      ) as Record<string, string | number | boolean>
    : null;

  return {
    id: str(raw.id),
    name: str(raw.name) ?? baseName(path),
    path,
    total_files: num(raw.total_files) ?? files.length,
    total_loc: num(raw.total_loc) ?? files.reduce((sum, f) => sum + (f.loc ?? 0), 0),
    files,
    git: git && Object.keys(git).length > 0 ? git : null,
  };
}

export interface IndexFileInput {
  file_path: string;
  source_code: string;
  language: string;
}

export interface IndexResult {
  indexed_files?: number;
  total_symbols?: number;
  total_chunks?: number;
  status?: string;
}

function normalizeIndex(raw: unknown): IndexResult {
  const o: Rec = isRec(raw) ? raw : {};
  return {
    indexed_files: num(o.indexed_files) ?? num(o.files_indexed) ?? num(o.total_files),
    total_symbols: num(o.total_symbols) ?? num(o.symbols_indexed) ?? num(o.symbols),
    total_chunks: num(o.total_chunks) ?? num(o.chunks_indexed) ?? num(o.chunks),
    status: str(o.status),
  };
}

// ---------------------------------------------------------------------------
// Knowledge graph
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  filePath?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Edges dropped because an endpoint is not present in the node list. */
  skippedEdges: number;
}

function normalizeGraph(raw: unknown): KnowledgeGraphData {
  if (!isRec(raw)) throw new ApiError("Unexpected response from /graph/export.");

  const seen = new Set<string>();
  const nodes: GraphNode[] = [];
  for (const n of Array.isArray(raw.nodes) ? raw.nodes : []) {
    if (!isRec(n)) continue;
    const id = firstStr(n, ["id", "symbol_id", "node_id"]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    nodes.push({
      id,
      label: firstStr(n, ["label", "name"]) ?? baseName(id.split("::").pop() ?? id),
      type: (firstStr(n, ["type", "node_type", "kind", "symbol_type"]) ?? "unknown").toLowerCase(),
      filePath: firstStr(n, ["file_path", "path", "file"]),
    });
  }

  const edges: GraphEdge[] = [];
  let skippedEdges = 0;
  for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
    if (!isRec(e)) continue;
    const source = firstStr(e, ["source", "from", "src"]);
    const target = firstStr(e, ["target", "to", "dst"]);
    if (!source || !target || !seen.has(source) || !seen.has(target)) {
      skippedEdges++;
      continue;
    }
    edges.push({
      id: `e${edges.length}`,
      source,
      target,
      relationship: (firstStr(e, ["relationship", "relation", "type", "edge_type", "kind"]) ?? "related").toLowerCase(),
    });
  }

  return { nodes, edges, skippedEdges };
}

export interface SymbolRef {
  id: string;
  label?: string;
}

/** Callers/callees come back as a list (of ids or objects), possibly wrapped in an object. */
function normalizeSymbolRefs(raw: unknown): SymbolRef[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (isRec(raw)) {
    const key = ["callers", "callees", "results", "symbols", "nodes", "items"].find((k) => Array.isArray(raw[k]));
    if (key) list = raw[key] as unknown[];
  }
  return list.flatMap((item): SymbolRef[] => {
    if (typeof item === "string") return [{ id: item }];
    if (isRec(item)) {
      const id = firstStr(item, ["id", "symbol_id", "node_id"]);
      return id ? [{ id, label: firstStr(item, ["label", "name"]) }] : [];
    }
    return [];
  });
}

// ---------------------------------------------------------------------------
// Blast radius
// ---------------------------------------------------------------------------

export interface AffectedNode {
  id: string;
  /** Distance from the selected symbol, when the backend provides depth_map. */
  depth?: number;
}

export interface BlastRadiusResult {
  symbolId: string;
  totalImpacted: number;
  affected: AffectedNode[];
}

function normalizeBlastRadius(raw: unknown, symbolId: string): BlastRadiusResult {
  if (!isRec(raw)) throw new ApiError("Unexpected response from /graph/blast-radius.");

  // depth_map can be { nodeId: depth } or { depth: [nodeIds] }.
  const depthById = new Map<string, number>();
  if (isRec(raw.depth_map)) {
    for (const [key, value] of Object.entries(raw.depth_map)) {
      if (typeof value === "number") depthById.set(key, value);
      else if (Array.isArray(value) && Number.isFinite(Number(key))) {
        for (const id of value) if (typeof id === "string") depthById.set(id, Number(key));
      }
    }
  }

  const affected: AffectedNode[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw.affected_nodes) ? raw.affected_nodes : []) {
    const id = typeof item === "string" ? item : isRec(item) ? firstStr(item, ["id", "symbol_id", "node_id"]) : undefined;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const inlineDepth = isRec(item) ? num(item.depth) : undefined;
    affected.push({ id, depth: depthById.get(id) ?? inlineDepth });
  }

  return {
    symbolId: str(raw.symbol_id) ?? symbolId,
    totalImpacted: num(raw.total_impacted) ?? affected.length,
    affected,
  };
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export interface MatchedChunk {
  file_path: string;
  source_code: string;
  score: number;
}

export interface InvestigationResult {
  query: string;
  matched_chunks: MatchedChunk[];
}

export interface ExplanationResponse {
  query: string;
  explanation: string;
}

export interface CodeFixRequest {
  issue: string;
  source_code?: string;
  repo_path?: string;
  file_path?: string;
  language?: string;
  context?: string;
}

export interface CodeFixResult {
  issue: string;
  language: string;
  file_path?: string | null;
  original_sha256?: string;
  status: string;
  original_code?: string | null;
  corrected_code?: string | null;
  diff?: string;
  changed?: boolean;
  model?: string;
  validation_status?: string;
  validation_message?: string;
  impact_analysis?: Record<string, unknown> | null;
}

const symbolQuery = (symbolId: string) => `symbol_id=${encodeURIComponent(symbolId)}`;

export const api = {
  getHealth: (signal?: AbortSignal) => fetchAPI<HealthResponse>("/health", { signal }),

  scanRepository: async (path: string, signal?: AbortSignal): Promise<ScanResult> =>
    normalizeScan(
      await fetchAPI<unknown>("/scan", { method: "POST", body: JSON.stringify({ path }), signal }),
      path
    ),

  indexFiles: async (files: IndexFileInput[], signal?: AbortSignal): Promise<IndexResult> =>
    normalizeIndex(
      await fetchAPI<unknown>("/index", { method: "POST", body: JSON.stringify({ files }), signal })
    ),

  exportGraph: async (signal?: AbortSignal): Promise<KnowledgeGraphData> =>
    normalizeGraph(await fetchAPI<unknown>("/graph/export", { signal })),

  getCallers: async (symbolId: string, signal?: AbortSignal): Promise<SymbolRef[]> =>
    normalizeSymbolRefs(await fetchAPI<unknown>(`/graph/callers?${symbolQuery(symbolId)}`, { signal })),

  getCallees: async (symbolId: string, signal?: AbortSignal): Promise<SymbolRef[]> =>
    normalizeSymbolRefs(await fetchAPI<unknown>(`/graph/callees?${symbolQuery(symbolId)}`, { signal })),

  getBlastRadius: async (symbolId: string, maxDepth = 3, signal?: AbortSignal): Promise<BlastRadiusResult> =>
    normalizeBlastRadius(
      await fetchAPI<unknown>(`/graph/blast-radius?${symbolQuery(symbolId)}&max_depth=${maxDepth}`, { signal }),
      symbolId
    ),

  // Used by the (currently unwired) ArcheologySearch component.
  investigate: (query: string, topK: number = 5) =>
    fetchAPI<InvestigationResult>("/archeology/investigate", {
      method: "POST",
      body: JSON.stringify({ query, top_k: topK }),
    }),

  explain: (query: string, topK: number = 5) =>
    fetchAPI<ExplanationResponse>("/llm/explain", {
      method: "POST",
      body: JSON.stringify({ query, top_k: topK }),
    }),

  codeFix: (request: CodeFixRequest, signal?: AbortSignal) =>
    fetchAPI<CodeFixResult>("/code-fix", {
      method: "POST",
      body: JSON.stringify(request),
      signal,
    }),

};
