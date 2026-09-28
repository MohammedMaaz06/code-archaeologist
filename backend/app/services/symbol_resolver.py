from typing import Dict, List, Any, Optional

class SymbolResolver:
    def __init__(self):
        # Maps symbol_name -> symbol metadata dict
        self.symbol_table: Dict[str, Dict[str, Any]] = {}
        # Maps (file_path, short_name) -> list of matching full symbol names
        self.local_scope_map: Dict[tuple, List[str]] = {}
        # Maps file_path -> list of import dicts
        self.file_imports: Dict[str, List[Dict[str, Any]]] = {}
        # Maps file_path -> variable/instance bindings
        # Example: service -> UserService
        self.file_bindings: Dict[str, Dict[str, str]] = {}

    def register_symbols(self, files_analysis: List[Dict[str, Any]]):
        """Builds symbol tables and import registers across indexed files."""
        for file_data in files_analysis:
            file_path = file_data.get("file_path", "")
            self.file_imports[file_path] = file_data.get("imports", [])

            self.file_bindings[file_path] = {
                binding.get("variable_name"): binding.get("class_name")
                for binding in file_data.get("variable_bindings", [])
                if binding.get("variable_name") and binding.get("class_name")
            }

            # Register classes
            for cls in file_data.get("classes", []):
                full_name = f"{file_path}:{cls['symbol_name']}"
                self.symbol_table[full_name] = {**cls, "full_symbol_id": full_name}
                
                key = (file_path, cls["symbol_name"])
                self.local_scope_map.setdefault(key, []).append(full_name)

            # Register functions
            for func in file_data.get("functions", []):
                full_name = f"{file_path}:{func['symbol_name']}"
                self.symbol_table[full_name] = {**func, "full_symbol_id": full_name}

                short_name = func.get("short_name", func["symbol_name"])
                key = (file_path, short_name)
                self.local_scope_map.setdefault(key, []).append(full_name)

            # Register class methods
            for cls in file_data.get("classes", []):
                class_name = cls["symbol_name"]

                for method in cls.get("methods", []):
                    method_name = method["symbol_name"]
                    full_name = f"{file_path}:{class_name}.{method_name}"

                    method_info = {
                        **method,
                        "symbol_name": f"{class_name}.{method_name}",
                        "short_name": method.get("short_name", method_name),
                        "class_name": class_name,
                        "file_path": file_path,
                        "full_symbol_id": full_name,
                    }

                    self.symbol_table[full_name] = method_info

                    key = (file_path, method_info["short_name"])
                    self.local_scope_map.setdefault(key, []).append(full_name)

    def resolve_call(
        self,
        caller_file: str,
        caller_symbol: str,
        target_name: str,
        receiver_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Resolves a function call target_name to its fully-qualified target symbol.
        Disambiguates between local scope, imported symbols, and global symbols.
        """
        # 1. Resolve receiver-aware member calls.
        #
        # Example:
        #   service = UserService()
        #   service.authenticate()
        #
        # The analyzer supplies:
        #   receiver_name="service"
        #   target_name="authenticate"
        #
        # We first resolve service -> UserService, then resolve
        # UserService.authenticate.
        if receiver_name:
            bindings = self.file_bindings.get(caller_file, {})
            class_name = bindings.get(receiver_name)

            if class_name:
                class_result = self.resolve_call(
                    caller_file=caller_file,
                    caller_symbol=caller_symbol,
                    target_name=class_name,
                )

                if (
                    class_result.get("resolved")
                    and class_result.get("symbol", {}).get("symbol_type") == "class"
                ):
                    class_id = class_result["target_symbol_id"]

                    method_candidates = [
                        (sym_id, sym_info)
                        for sym_id, sym_info in self.symbol_table.items()
                        if sym_id.startswith(class_id + ".")
                        and sym_info.get("short_name") == target_name
                    ]

                    if len(method_candidates) == 1:
                        method_id, method_info = method_candidates[0]

                        return {
                            "resolved": True,
                            "target_symbol_id": method_id,
                            "resolution_type": "instance_member",
                            "symbol": method_info,
                        }

        # 2. Check local file scope
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
            module = imp.get("module") or ""

            if alias == target_name or imported_name == target_name:
                target_symbol = (
                    imported_name
                    if imported_name != "*"
                    else target_name
                )

                module_normalized = (
                    module
                    .replace("\\", "/")
                    .lstrip("./")
                )

                module_stem = module_normalized
                for extension in (".py", ".js", ".ts", ".tsx"):
                    if module_stem.endswith(extension):
                        module_stem = module_stem[:-len(extension)]
                        break

                module_dotted = module_stem.replace("/", ".")

                for sym_id, sym_info in self.symbol_table.items():
                    symbol_file = (
                        sym_info.get("file_path", "")
                        .replace("\\", "/")
                        .lstrip("./")
                    )

                    symbol_stem = symbol_file
                    for extension in (".py", ".js", ".ts", ".tsx"):
                        if symbol_stem.endswith(extension):
                            symbol_stem = symbol_stem[:-len(extension)]
                            break

                    symbol_dotted = symbol_stem.replace("/", ".")

                    module_matches = (
                        symbol_file == module_normalized
                        or symbol_file.endswith("/" + module_normalized)
                        or symbol_stem == module_stem
                        or symbol_dotted == module_dotted
                        or symbol_dotted.endswith("." + module_dotted)
                    )

                    if target_symbol in sym_id and module_matches:
                        return {
                            "resolved": True,
                            "target_symbol_id": sym_id,
                            "resolution_type": "imported",
                            "symbol": sym_info
                        }

                    # Resolve member calls on an imported class:
                    # UserService.authenticate -> auth.py:UserService.authenticate
                    imported_class_id = f"{sym_info.get('file_path', '')}:{target_symbol}"

                    if (
                        sym_info.get("symbol_type") == "class"
                        and sym_id == imported_class_id
                    ):
                        method_matches = [
                            (method_id, method_info)
                            for method_id, method_info in self.symbol_table.items()
                            if method_id.startswith(imported_class_id + ".")
                            and method_info.get("short_name") == target_name
                        ]

                        if len(method_matches) == 1:
                            method_id, method_info = method_matches[0]
                            return {
                                "resolved": True,
                                "target_symbol_id": method_id,
                                "resolution_type": "imported_member",
                                "symbol": method_info
                            }

        # 3. Fallback: Fuzzy global search across symbol table
        matching_globals = [
            sym_id for sym_id, sym_info in self.symbol_table.items()
            if sym_info.get("short_name") == target_name
            or sym_id.endswith(f":{target_name}")
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
