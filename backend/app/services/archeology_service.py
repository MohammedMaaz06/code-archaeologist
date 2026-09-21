from typing import Dict, List, Any, Optional
from app.services.graph_service import DependencyGraphService
from app.services.vector_service import VectorSearchService


class ArcheologyEngine:
    def __init__(self, graph_service: DependencyGraphService, vector_service: VectorSearchService):
        self.graph_service = graph_service
        self.vector_service = vector_service

    def investigate(self, query: str, top_k: int = 3) -> Dict[str, Any]:
        # Step 1: Perform vector search for relevant code chunks
        vector_results = self.vector_service.query(query, top_k=top_k)

        investigated_files = set()
        matched_chunks = []

        for item in vector_results:
            chunk = item["chunk"]
            score = item["score"]
            file_path = chunk["file_path"]
            investigated_files.add(file_path)

            matched_chunks.append({
                "score": score,
                "file_path": file_path,
                "symbol_name": chunk.get("symbol_name"),
                "lines": f"{chunk['start_line']}-{chunk['end_line']}",
                "content": chunk["content"]
            })

        # Step 2: Enrich with Graph Dependency Context
        graph_context = {}
        for file_path in investigated_files:
            deps = self.graph_service.get_file_dependencies(file_path)
            graph_context[file_path] = deps

        return {
            "query": query,
            "relevant_files": list(investigated_files),
            "matched_chunks": matched_chunks,
            "dependency_context": graph_context,
            "summary": f"Found {len(matched_chunks)} relevant code regions across {len(investigated_files)} files."
        }

    def analyze_impact(self, target_file: str) -> Dict[str, Any]:
        deps = self.graph_service.get_file_dependencies(target_file)
        
        direct_dependents = deps.get("imported_by", [])
        blast_radius_score = len(direct_dependents)

        risk_level = "LOW"
        if blast_radius_score > 5:
            risk_level = "HIGH"
        elif blast_radius_score > 2:
            risk_level = "MEDIUM"

        return {
            "target_file": target_file,
            "direct_dependencies": deps.get("imports", []),
            "affected_files": direct_dependents,
            "blast_radius_score": blast_radius_score,
            "risk_level": risk_level
        }
