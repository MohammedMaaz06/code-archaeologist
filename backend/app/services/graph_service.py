import networkx as nx
from typing import Dict, List, Any, Optional
from app.core.logging import logger


class DependencyGraphService:
    def __init__(self):
        self.graph = nx.DiGraph()

    def clear(self):
        self.graph.clear()

    def add_file_node(self, relative_path: str, language: str, loc: int):
        self.graph.add_node(
            relative_path,
            type="file",
            language=language,
            loc=loc
        )

    def add_symbol_node(self, symbol_id: str, name: str, kind: str, file_path: str):
        self.graph.add_node(
            symbol_id,
            type="symbol",
            name=name,
            kind=kind,
            file_path=file_path
        )
        # Link file -> symbol
        if file_path in self.graph:
            self.graph.add_edge(file_path, symbol_id, relation="CONTAINS")

    def add_import_dependency(self, source_file: str, target_import: str):
        self.graph.add_node(target_import, type="module")
        self.graph.add_edge(source_file, target_import, relation="IMPORTS")

    def add_call_dependency(self, caller_symbol_id: str, callee_name: str):
        self.graph.add_node(callee_name, type="unresolved_symbol")
        self.graph.add_edge(caller_symbol_id, callee_name, relation="CALLS")

    def get_file_dependencies(self, relative_path: str) -> Dict[str, List[str]]:
        if relative_path not in self.graph:
            return {"imports": [], "imported_by": []}

        imports = [
            target for _, target, data in self.graph.out_edges(relative_path, data=True)
            if data.get("relation") == "IMPORTS"
        ]
        imported_by = [
            source for source, _, data in self.graph.in_edges(relative_path, data=True)
            if data.get("relation") == "IMPORTS"
        ]

        return {
            "imports": imports,
            "imported_by": imported_by
        }

    def get_graph_metrics(self) -> Dict[str, Any]:
        num_nodes = self.graph.number_of_nodes()
        num_edges = self.graph.number_of_edges()

        # Find top 5 most depended-on nodes
        in_degrees = dict(self.graph.in_degree())
        top_dependencies = sorted(in_degrees.items(), key=lambda x: x[1], reverse=True)[:5]

        return {
            "total_nodes": num_nodes,
            "total_edges": num_edges,
            "is_directed": self.graph.is_directed(),
            "top_depended_nodes": [{"node": node, "in_degree": deg} for node, deg in top_dependencies if deg > 0]
        }
