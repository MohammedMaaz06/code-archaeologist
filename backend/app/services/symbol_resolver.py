from typing import Dict, List, Any, Optional

class SymbolResolver:
    def __init__(self):
        # Maps symbol_name -> symbol metadata dict
        self.symbol_table: Dict[str, Dict[str, Any]] = {}
        # Maps (file_path, short_name) -> list of matching full symbol names
        self.local_scope_map: Dict[tuple, List[str]] = {}
        # Maps file_path -> list of import dicts
        self.file_imports: Dict[str, List[Dict[str, Any]]] = {}

    def register_symbols(self, files_analysis: List[Dict[str, Any]]):
        """Builds symbol tables and import registers across indexed files."""
        for file_data in files_analysis:
            file_path = file_data.get("file_path", "")
            self.file_imports[file_path] = file_data.get("imports", [])

            # Register classes
            for cls in file_data.get("classes", []):
                full_name = f"{file_path}:{cls['symbol_name']}"
                self.symbol_table[full_name] = {**cls, "full_symbol_id": full_name}
                
                key = (file_path, cls["symbol_name"])
                self.local_scope_map.setdefault(key, []).append(full_name)

            # Register functions & methods
            for func in file_data.get("functions", []):
                full_name = f"{file_path}:{func['symbol_name']}"
                self.symbol_table[full_name] = {**func, "full_symbol_id": full_name}

                short_name = func.get("short_name", func["symbol_name"])
                key = (file_path, short_name)
                self.local_scope_map.setdefault(key, []).append(full_name)

    def resolve_call(self, caller_file: str, caller_symbol: str, target_name: str) -> Dict[str, Any]:
        """
        Resolves a function call target_name to its fully-qualified target symbol.
        Disambiguates between local scope, imported symbols, and global symbols.
        """
        # 1. Check local file scope
        local_key = (caller_file, target_name)
        if local_key in self.local_scope_map:
            resolved_id = self.local_scope_map[local_key][0]
            return {
                "resolved": True,
                "target_symbol_id": resolved_id,
                "resolution_type": "local",
                "symbol": self.symbol_table[resolved_id]
            }

        # 2. Check imports in caller_file
        imports = self.file_imports.get(caller_file, [])
        for imp in imports:
            imported_name = imp.get("imported_name")
            alias = imp.get("alias")
            module = imp.get("module")

            # Match alias or direct import name
            if alias == target_name or imported_name == target_name:
                target_symbol = imported_name if imported_name != "*" else target_name
                # Find matching symbols from module path
                for sym_id, sym_info in self.symbol_table.items():
                    if target_symbol in sym_id and module.replace(".", "/") in sym_info["file_path"]:
                        return {
                            "resolved": True,
                            "target_symbol_id": sym_id,
                            "resolution_type": "imported",
                            "symbol": sym_info
                        }

        # 3. Fallback: Fuzzy global search across symbol table
        matching_globals = [
            sym_id for sym_id, sym_info in self.symbol_table.items()
            if sym_info.get("short_name") == target_name or sym_id.endswith(f":{target_name}")
        ]

        if len(matching_globals) == 1:
            sym_id = matching_globals[0]
            return {
                "resolved": True,
                "target_symbol_id": sym_id,
                "resolution_type": "global_unique",
                "symbol": self.symbol_table[sym_id]
            }
        elif len(matching_globals) > 1:
            return {
                "resolved": False,
                "target_symbol_id": None,
                "resolution_type": "ambiguous",
                "candidates": matching_globals
            }

        return {
            "resolved": False,
            "target_symbol_id": None,
            "resolution_type": "unresolved"
        }