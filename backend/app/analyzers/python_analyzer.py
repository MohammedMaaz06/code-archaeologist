import ast
from pathlib import Path
from typing import List, Dict, Any, Optional


class ExtractedSymbol:
    def __init__(
        self,
        name: str,
        kind: str,
        start_line: int,
        end_line: int,
        parent_symbol: Optional[str] = None,
        signature: Optional[str] = None,
        caller_symbol: Optional[str] = None,
    ):
        self.name = name
        self.kind = kind
        self.start_line = start_line
        self.end_line = end_line
        self.parent_symbol = parent_symbol
        self.signature = signature
        self.caller_symbol = caller_symbol

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "parent_symbol": self.parent_symbol,
            "signature": self.signature,
            "caller_symbol": self.caller_symbol,
        }


class PythonASTAnalyzer:
    def __init__(self, file_path: Path, source_code: Optional[str] = None):
        self.file_path = Path(file_path)
        self.source_code = (
            source_code
            if source_code is not None
            else self.file_path.read_text(encoding="utf-8", errors="ignore")
        )

    def _parse(self):
        try:
            return ast.parse(self.source_code, filename=str(self.file_path))
        except SyntaxError:
            return None

    def extract_symbols(self) -> List[ExtractedSymbol]:
        """
        Backward-compatible flat symbol extraction used by the API.

        Returns:
            classes, functions, methods, imports and calls as ExtractedSymbol objects.
        """
        tree = self._parse()
        if tree is None:
            return []

        symbols: List[ExtractedSymbol] = []

        class SymbolVisitor(ast.NodeVisitor):
            def __init__(self):
                self.current_class: Optional[str] = None
                self.current_function: Optional[str] = None

            def visit_ClassDef(self, node: ast.ClassDef):
                symbols.append(
                    ExtractedSymbol(
                        name=node.name,
                        kind="class",
                        start_line=node.lineno,
                        end_line=getattr(node, "end_lineno", node.lineno),
                        parent_symbol=None,
                        signature=f"class {node.name}",
                    )
                )

                previous_class = self.current_class
                self.current_class = node.name
                self.generic_visit(node)
                self.current_class = previous_class

            def _visit_function(self, node, is_async: bool = False):
                kind = "method" if self.current_class else "function"

                args_list = [
                    arg.arg
                    for arg in (
                        list(node.args.posonlyargs)
                        + list(node.args.args)
                        + list(node.args.kwonlyargs)
                    )
                ]

                sig = f"{node.name}({', '.join(args_list)})"
                if is_async:
                    sig = f"async {sig}"

                symbols.append(
                    ExtractedSymbol(
                        name=node.name,
                        kind=kind,
                        start_line=node.lineno,
                        end_line=getattr(node, "end_lineno", node.lineno),
                        parent_symbol=self.current_class,
                        signature=sig,
                    )
                )

                previous_function = self.current_function
                self.current_function = node.name
                self.generic_visit(node)
                self.current_function = previous_function

            def visit_FunctionDef(self, node: ast.FunctionDef):
                self._visit_function(node, is_async=False)

            def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
                self._visit_function(node, is_async=True)

            def visit_Import(self, node: ast.Import):
                for alias in node.names:
                    symbols.append(
                        ExtractedSymbol(
                            name=alias.name,
                            kind="import",
                            start_line=node.lineno,
                            end_line=getattr(node, "end_lineno", node.lineno),
                            signature=f"import {alias.name}",
                        )
                    )

            def visit_ImportFrom(self, node: ast.ImportFrom):
                module = node.module or ""

                for alias in node.names:
                    imported_name = alias.name
                    import_name = (
                        f"{module}.{imported_name}"
                        if module
                        else imported_name
                    )

                    symbols.append(
                        ExtractedSymbol(
                            name=import_name,
                            kind="import",
                            start_line=node.lineno,
                            end_line=getattr(node, "end_lineno", node.lineno),
                            signature=(
                                f"from {module} import {imported_name}"
                                if module
                                else f"import {imported_name}"
                            ),
                        )
                    )

            def visit_Call(self, node: ast.Call):
                func_name = None

                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr

                if func_name:
                    symbols.append(
                        ExtractedSymbol(
                            name=func_name,
                            kind="call",
                            start_line=node.lineno,
                            end_line=getattr(node, "end_lineno", node.lineno),
                            caller_symbol=self.current_function,
                        )
                    )

                self.generic_visit(node)

        visitor = SymbolVisitor()
        visitor.visit(tree)

        return symbols

    def analyze(self) -> Dict[str, Any]:
        """
        Produce structured analysis consumed by SymbolResolver and GraphService.

        The returned schema is:

        {
            "file_path": "...",
            "language": "python",
            "imports": [...],
            "classes": [...],
            "functions": [...],
            "calls": [...]
        }
        """
        tree = self._parse()

        result: Dict[str, Any] = {
            "file_path": str(self.file_path),
            "language": "python",
            "imports": [],
            "classes": [],
            "functions": [],
            "calls": [],
        }

        if tree is None:
            return result

        class AnalysisVisitor(ast.NodeVisitor):
            def __init__(self):
                self.current_class: Optional[str] = None
                self.current_function: Optional[str] = None

            def visit_Import(self, node: ast.Import):
                for alias in node.names:
                    result["imports"].append(
                        {
                            "module": alias.name,
                            "imported_name": alias.name,
                            "alias": alias.asname,
                            "start_line": node.lineno,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                        }
                    )

            def visit_ImportFrom(self, node: ast.ImportFrom):
                module = node.module or ""

                for alias in node.names:
                    result["imports"].append(
                        {
                            "module": module,
                            "imported_name": alias.name,
                            "alias": alias.asname,
                            "start_line": node.lineno,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                        }
                    )

            def visit_ClassDef(self, node: ast.ClassDef):
                class_data = {
                    "symbol_name": node.name,
                    "short_name": node.name,
                    "symbol_type": "class",
                    "file_path": str(self_outer.file_path),
                    "start_line": node.lineno,
                    "end_line": getattr(node, "end_lineno", node.lineno),
                    "parent_symbol": None,
                }

                result["classes"].append(class_data)

                previous_class = self.current_class
                self.current_class = node.name
                self.generic_visit(node)
                self.current_class = previous_class

            def _visit_function(self, node, is_async: bool = False):
                args_list = [
                    arg.arg
                    for arg in (
                        list(node.args.posonlyargs)
                        + list(node.args.args)
                        + list(node.args.kwonlyargs)
                    )
                ]

                signature = f"{node.name}({', '.join(args_list)})"
                if is_async:
                    signature = f"async {signature}"

                symbol_type = "method" if self.current_class else "function"

                function_data = {
                    "symbol_name": node.name,
                    "short_name": node.name,
                    "symbol_type": symbol_type,
                    "file_path": str(self_outer.file_path),
                    "start_line": node.lineno,
                    "end_line": getattr(node, "end_lineno", node.lineno),
                    "parent_symbol": self.current_class,
                    "signature": signature,
                }

                result["functions"].append(function_data)

                previous_function = self.current_function
                self.current_function = node.name
                self.generic_visit(node)
                self.current_function = previous_function

            def visit_FunctionDef(self, node: ast.FunctionDef):
                self._visit_function(node, is_async=False)

            def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
                self._visit_function(node, is_async=True)

            def visit_Call(self, node: ast.Call):
                target_name = None

                if isinstance(node.func, ast.Name):
                    target_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    target_name = node.func.attr

                if target_name:
                    caller_name = self.current_function

                    caller_symbol_id = None
                    if caller_name:
                        caller_symbol_id = (
                            f"{self_outer.file_path}:{caller_name}"
                        )

                    result["calls"].append(
                        {
                            "target_name": target_name,
                            "caller_symbol": caller_name,
                            "caller_symbol_id": caller_symbol_id,
                            "file_path": str(self_outer.file_path),
                            "start_line": node.lineno,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                        }
                    )

                self.generic_visit(node)

        self_outer = self
        AnalysisVisitor().visit(tree)

        return result

    def parse_code(self, source_code: Optional[str] = None) -> Dict[str, Any]:
        """
        Compatibility wrapper for older callers/tests.
        """
        if source_code is not None:
            previous_source = self.source_code
            self.source_code = source_code
            try:
                return self.analyze()
            finally:
                self.source_code = previous_source

        return self.analyze()
