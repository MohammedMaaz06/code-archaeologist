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
    ):
        self.name = name
        self.kind = kind
        self.start_line = start_line
        self.end_line = end_line
        self.parent_symbol = parent_symbol
        self.signature = signature

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "parent_symbol": self.parent_symbol,
            "signature": self.signature,
        }


class PythonASTAnalyzer:
    def __init__(self, file_path: Path, source_code: Optional[str] = None):
        self.file_path = file_path
        self.source_code = source_code or file_path.read_text(encoding="utf-8", errors="ignore")

    def extract_symbols(self) -> List[ExtractedSymbol]:
        symbols: List[ExtractedSymbol] = []
        try:
            tree = ast.parse(self.source_code, filename=str(self.file_path))
        except SyntaxError:
            return symbols

        class SymbolVisitor(ast.NodeVisitor):
            def __init__(self):
                self.current_class: Optional[str] = None

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

            def visit_FunctionDef(self, node: ast.FunctionDef):
                kind = "method" if self.current_class else "function"
                args_list = [arg.arg for arg in node.args.args]
                sig = f"{node.name}({', '.join(args_list)})"
                
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
                self.generic_visit(node)

            def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
                kind = "method" if self.current_class else "function"
                args_list = [arg.arg for arg in node.args.args]
                sig = f"async {node.name}({', '.join(args_list)})"

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
                self.generic_visit(node)

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
                    symbols.append(
                        ExtractedSymbol(
                            name=f"{module}.{alias.name}" if module else alias.name,
                            kind="import",
                            start_line=node.lineno,
                            end_line=getattr(node, "end_lineno", node.lineno),
                            signature=f"from {module} import {alias.name}",
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
                        )
                    )

        visitor = SymbolVisitor()
        visitor.visit(tree)
        return symbols
