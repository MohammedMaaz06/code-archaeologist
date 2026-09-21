const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export interface ExtractedSymbol {
  name: string;
  kind: string;
  file_path: string;
  line_number: number;
}

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

export interface GraphNodeResponse {
  id: string;
  label: string;
  type: "function" | "class" | "module" | "variable";
  file_path?: string;
}

export interface GraphEdgeResponse {
  id: string;
  source: string;
  target: string;
  relationship: "calls" | "imports" | "inherits" | "contains";
}

export interface BuildGraphResponse {
  status: string;
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  getHealth: () => 
    fetchAPI<{ status: string }>("/health"),

  extractSymbols: (filePath: string) =>
    fetchAPI<ExtractedSymbol[]>("/symbols/extract", {
      method: "POST",
      body: JSON.stringify({ file_path: filePath }),
    }),

  buildGraph: (
    files: Array<{ relative_path: string; language: string; loc: number }> = [],
    symbols: ExtractedSymbol[] = []
  ) =>
    fetchAPI<BuildGraphResponse>("/graph/build", {
      method: "POST",
      body: JSON.stringify({ files, symbols }),
    }),

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
};
