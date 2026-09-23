import networkx as nx
from typing import Dict, List, Any, Optional

class GraphService:
    def __init__(self):
        self.graph = nx.DiGraph()

    def build_graph_from_symbols(self, symbols_data: List[Dict[str, Any]], resolved_calls: List[Dict[str, Any]]):
        """
        Populates NetworkX graph with File, Class, Function, API, and DB nodes and edges.
        """
        self.graph.clear()

        for sym in symbols_data:
            sym_id = sym.get("symbol_id") or sym.get("full_symbol_id") or sym.get("symbol_name")
            sym_type = sym.get("symbol_type", "function")
            file_path = sym.get("file_path", "")

            # 1. Add File Node
            if file_path and not self.graph.has_node(file_path):
                self.graph.add_node(file_path, node_type="File", label=file_path)

            # 2. Add Symbol Node (Function / Class / Method)
            self.graph.add_node(
                sym_id,
                node_type=sym_type.capitalize(),
                label=sym.get("short_name", sym.get("symbol_name")),
                file_path=file_path,
                start_line=sym.get("start_line"),
                end_line=sym.get("end_line")
            )

            # Connect File -> Symbol (CONTAINS)
            if file_path:
                self.graph.add_edge(file_path, sym_id, relation="CONTAINS")

            # 3. Detect API Endpoints
            decorators = sym.get("decorators", [])
            for dec in decorators:
                if any(verb in dec.lower() for verb in ["get", "post", "put", "delete", "patch", "api"]):
                    api_node_id = f"API:{dec}:{sym_id}"
                    self.graph.add_node(api_node_id, node_type="API", endpoint=dec, handler=sym_id)
                    self.graph.add_edge(sym_id, api_node_id, relation="EXPOSES_API")

            # 4. Detect DB Operations
            docstring = sym.get("docstring", "") or ""
            code_text = sym.get("code", "") or ""
            if any(db_kw in (docstring + code_text).lower() for db_kw in ["select", "insert", "update", "delete", "query", "session.query"]):
                db_node_id = f"DB:{sym_id}"
                self.graph.add_node(db_node_id, node_type="DatabaseOperation", queried_by=sym_id)
                self.graph.add_edge(sym_id, db_node_id, relation="PERFORMS_DB_OP")

        # 5. Add Function-to-Function CALLS edges
        for call in resolved_calls:
            caller = call.get("caller_symbol_id")
            target = call.get("target_symbol_id")
            if caller and target and self.graph.has_node(caller) and self.graph.has_node(target):
                self.graph.add_edge(caller, target, relation="CALLS")

    def get_callers(self, symbol_id: str) -> List[str]:
        """Returns all functions that call the given symbol."""
        if not self.graph.has_node(symbol_id):
            return []
        return [node for node, _, data in self.graph.in_edges(symbol_id, data=True) if data.get("relation") == "CALLS"]

    def get_callees(self, symbol_id: str) -> List[str]:
        """Returns all functions called by the given symbol."""
        if not self.graph.has_node(symbol_id):
            return []
        return [target for _, target, data in self.graph.out_edges(symbol_id, data=True) if data.get("relation") == "CALLS"]

    def get_blast_radius(self, symbol_id: str, max_depth: int = 3) -> Dict[str, Any]:
        """
        Calculates impact radius (upstream callers) when a symbol is modified.
        """
        if not self.graph.has_node(symbol_id):
            return {"affected_nodes": [], "depth_map": {}}

        visited = {}
        queue = [(symbol_id, 0)]

        while queue:
            curr, depth = queue.pop(0)
            if curr in visited and visited[curr] <= depth:
                continue
            visited[curr] = depth

            if depth < max_depth:
                # Traverse backwards via callers (in-edges)
                for caller in self.get_callers(curr):
                    queue.append((caller, depth + 1))

        return {
            "affected_nodes": list(visited.keys()),
            "depth_map": visited,
            "total_impacted": len(visited) - 1
        }

    def export_graph(self) -> Dict[str, Any]:
        """Exports full graph in Cytoscape/3D visualization format."""
        nodes = []
        for node_id, attrs in self.graph.nodes(data=True):
            nodes.append({"id": node_id, **attrs})

        edges = []
        for u, v, attrs in self.graph.edges(data=True):
            edges.append({"source": u, "target": v, **attrs})

        return {"nodes": nodes, "edges": edges}