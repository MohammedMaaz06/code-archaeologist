from pydantic import BaseModel, Field
from typing import List, Optional

class CodeSearchRequest(BaseModel):
    query: str = Field(..., description="Natural language or symbol search query")
    top_k: int = Field(default=5, ge=1, le=50, description="Max search results to return")
    include_subgraph: bool = Field(default=True, description="Whether to include call graph nodes and edges")
    depth: int = Field(default=2, ge=1, le=5, description="Graph traversal depth for call dependencies")

class GraphNode(BaseModel):
    id: str
    name: str
    kind: str
    file_path: Optional[str] = None
    line_number: Optional[int] = None

class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str

class SearchResultItem(BaseModel):
    symbol_id: str
    name: str
    kind: str
    file_path: str
    score: float
    snippet: Optional[str] = None

class CodeSearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItem]
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []
