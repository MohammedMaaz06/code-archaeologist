import networkx as nx
from typing import Dict, List, Any, Optional

class GraphService:
    def __init__(self):
        self.graph = nx.DiGraph()

    def add_file_node(self, file_path: str, language: str = "python", lines: int = 0):
        self.graph.add_node(file_path, node_type="File", language=language, lines=lines, label=file_path)

    def build_graph_from_symbols(self, symbols_data: List[Dict[str, Any]], resolved_calls: List[Dict[str, Any]]):
        self.graph.clear()

        for sym in symbols_data:
            sym_id = sym.get("symbol_id") or sym.get("full_symbol_id") or sym.get("symbol_name")
            sym_type = sym.get("symbol_type", "function")
            file_path = sym.get("file_path", "")

            if file_path and not self.graph.has_node(file_path):
                self.add_file_node(file_path)

            self.graph.add_node(
                sym_id,
                node_type=sym_type.capitalize(),
                label=sym.get("short_name", sym.get("symbol_name")),
                file_path=file_path,
                start_line=sym.get("start_line"),
                end_line=sym.get("end_line")
            )

            if file_path:
                self.graph.add_edge(file_path, sym_id, relation="CONTAINS")

        for call in resolved_calls:
            caller = call.get("caller_symbol_id")
            target = call.get("target_symbol_id")
            if caller and target and self.graph.has_node(caller) and self.graph.has_node(target):
                self.graph.add_edge(caller, target, relation="CALLS")

    def get_callers(self, symbol_id: str) -> List[str]:
        if not self.graph.has_node(symbol_id):
            return []
        return [node for node, _, data in self.graph.in_edges(symbol_id, data=True) if data.get("relation") == "CALLS"]

    def get_callees(self, symbol_id: str) -> List[str]:
        if not self.graph.has_node(symbol_id):
            return []
        return [target for _, target, data in self.graph.out_edges(symbol_id, data=True) if data.get("relation") == "CALLS"]

    def get_blast_radius(self, symbol_id: str, max_depth: int = 3) -> Dict[str, Any]:
        if not self.graph.has_node(symbol_id):
            return {"affected_nodes": [], "depth_map": {}, "total_impacted": 0}

        visited = {}
        queue = [(symbol_id, 0)]

        while queue:
            curr, depth = queue.pop(0)
            if curr in visited and visited[curr] <= depth:
                continue
            visited[curr] = depth

            if depth < max_depth:
                for caller in self.get_callers(curr):
                    queue.append((caller, depth + 1))

        return {
            "affected_nodes": list(visited.keys()),
            "depth_map": visited,
            "total_impacted": max(0, len(visited) - 1)
        }

    def export_graph(self) -> Dict[str, Any]:
        nodes = [{"id": node_id, **attrs} for node_id, attrs in self.graph.nodes(data=True)]
        edges = [{"source": u, "target": v, **attrs} for u, v, attrs in self.graph.edges(data=True)]
        return {"nodes": nodes, "edges": edges}

DependencyGraphService = GraphService