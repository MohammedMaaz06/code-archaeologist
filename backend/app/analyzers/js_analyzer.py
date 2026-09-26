from pathlib import Path
from typing import Any, Dict, List, Optional

from tree_sitter import Language, Parser
import tree_sitter_javascript
import tree_sitter_typescript

from app.analyzers.python_analyzer import ExtractedSymbol


class JSTSAnalyzer:
    """
    Tree-sitter based JavaScript / TypeScript analyzer.

    Extracts:
    - imports
    - classes
    - functions
    - class methods
    - function/method calls

    The analyzer intentionally returns ExtractedSymbol objects so it remains
    compatible with the existing repository analysis pipeline.
    """

    def __init__(self, file_path: Path, source_code: Optional[str] = None):
        self.file_path = file_path
        self.source_code = (
            source_code
            if source_code is not None
            else file_path.read_text(encoding="utf-8", errors="ignore")
        )

        self.language_name = self._detect_language()
        self.parser = Parser(self._get_language())

    def _detect_language(self) -> str:
        suffix = self.file_path.suffix.lower()

        if suffix in {".ts", ".tsx"}:
            return "typescript"

        return "javascript"

    def _get_language(self) -> Language:
        if self.language_name == "typescript":
            if self.file_path.suffix.lower() == ".tsx":
                return Language(tree_sitter_typescript.language_tsx())

            return Language(tree_sitter_typescript.language_typescript())

        return Language(tree_sitter_javascript.language())

    def _parse(self):
        return self.parser.parse(self.source_code.encode("utf-8"))

    def _node_text(self, node) -> str:
        return self.source_code.encode("utf-8")[node.start_byte:node.end_byte].decode(
            "utf-8",
            errors="ignore",
        )

    def _line(self, node) -> int:
        return node.start_point.row + 1

    def _end_line(self, node) -> int:
        return node.end_point.row + 1

    def extract_symbols(self) -> List[ExtractedSymbol]:
        """
        Backward-compatible symbol extraction API.

        Returns functions, classes, methods and imports.
        """
        tree = self._parse()

        symbols: List[ExtractedSymbol] = []

        self._walk_symbols(
            tree.root_node,
            symbols,
            parent_symbol=None,
        )

        return symbols

    def analyze(self) -> Dict[str, Any]:
        """
        Return structured analysis consumed by RepositoryAnalysisService.
        """
        tree = self._parse()

        imports: List[Dict[str, Any]] = []
        classes: List[Dict[str, Any]] = []
        functions: List[Dict[str, Any]] = []
        calls: List[Dict[str, Any]] = []

        self._walk_analysis(
            tree.root_node,
            imports=imports,
            classes=classes,
            functions=functions,
            calls=calls,
            parent_symbol=None,
            current_symbol=None,
        )

        return {
            "file_path": str(self.file_path),
            "language": self.language_name,
            "imports": imports,
            "classes": classes,
            "functions": functions,
            "calls": calls,
        }

    def _walk_symbols(
        self,
        node,
        symbols: List[ExtractedSymbol],
        parent_symbol: Optional[str],
    ) -> None:
        node_type = node.type

        if node_type in {
            "function_declaration",
            "function",
            "generator_function_declaration",
        }:
            name_node = node.child_by_field_name("name")

            if name_node is not None:
                name = self._node_text(name_node)

                symbols.append(
                    ExtractedSymbol(
                        name=name,
                        kind="function",
                        start_line=self._line(node),
                        end_line=self._end_line(node),
                        signature=self._node_text(node).split("{", 1)[0].strip(),
                        parent_symbol=parent_symbol,
                    )
                )

        elif node_type == "class_declaration":
            name_node = node.child_by_field_name("name")

            if name_node is not None:
                name = self._node_text(name_node)

                symbols.append(
                    ExtractedSymbol(
                        name=name,
                        kind="class",
                        start_line=self._line(node),
                        end_line=self._end_line(node),
                        signature=self._node_text(node).split("{", 1)[0].strip(),
                        parent_symbol=parent_symbol,
                    )
                )

                parent_symbol = name

        elif node_type in {
            "method_definition",
            "method_signature",
        }:
            name_node = node.child_by_field_name("name")

            if name_node is not None:
                name = self._node_text(name_node)

                symbols.append(
                    ExtractedSymbol(
                        name=name,
                        kind="method",
                        start_line=self._line(node),
                        end_line=self._end_line(node),
                        signature=self._node_text(node).split("{", 1)[0].strip(),
                        parent_symbol=parent_symbol,
                    )
                )

        elif node_type in {
            "import_statement",
            "import_clause",
        }:
            module = node.child_by_field_name("source")

            if module is not None:
                module_name = self._node_text(module).strip("'\"")

                symbols.append(
                    ExtractedSymbol(
                        name=module_name,
                        kind="import",
                        start_line=self._line(node),
                        end_line=self._end_line(node),
                        signature=self._node_text(node),
                        parent_symbol=parent_symbol,
                    )
                )

        for child in node.children:
            self._walk_symbols(
                child,
                symbols,
                parent_symbol=parent_symbol,
            )

    def _walk_analysis(
        self,
        node,
        imports: List[Dict[str, Any]],
        classes: List[Dict[str, Any]],
        functions: List[Dict[str, Any]],
        calls: List[Dict[str, Any]],
        parent_symbol: Optional[str],
        current_symbol: Optional[str],
    ) -> None:
        node_type = node.type

        if node_type == "import_statement":
            self._extract_import(node, imports)

        elif node_type == "class_declaration":
            name_node = node.child_by_field_name("name")

            if name_node is not None:
                class_name = self._node_text(name_node)

                classes.append(
                    {
                        "symbol_name": class_name,
                        "short_name": class_name,
                        "file_path": str(self.file_path),
                        "start_line": self._line(node),
                        "end_line": self._end_line(node),
                        "signature": self._node_text(node).split("{", 1)[0].strip(),
                        "symbol_type": "class",
                    }
                )

                parent_symbol = class_name
                current_symbol = class_name

        elif node_type in {
            "function_declaration",
            "generator_function_declaration",
        }:
            name_node = node.child_by_field_name("name")

            if name_node is not None:
                function_name = self._node_text(name_node)

                functions.append(
                    {
                        "symbol_name": function_name,
                        "short_name": function_name,
                        "file_path": str(self.file_path),
                        "start_line": self._line(node),
                        "end_line": self._end_line(node),
                        "signature": self._node_text(node).split("{", 1)[0].strip(),
                        "symbol_type": "function",
                        "parent_symbol": parent_symbol,
                    }
                )

                current_symbol = function_name

        elif node_type == "method_definition":
            name_node = node.child_by_field_name("name")

            if name_node is not None:
                method_name = self._node_text(name_node)

                functions.append(
                    {
                        "symbol_name": method_name,
                        "short_name": method_name,
                        "file_path": str(self.file_path),
                        "start_line": self._line(node),
                        "end_line": self._end_line(node),
                        "signature": self._node_text(node).split("{", 1)[0].strip(),
                        "symbol_type": "method",
                        "parent_symbol": parent_symbol,
                    }
                )

                current_symbol = method_name

        elif node_type == "call_expression":
            self._extract_call(
                node,
                calls,
                current_symbol=current_symbol,
            )

        for child in node.children:
            child_parent = parent_symbol
            child_current = current_symbol

            self._walk_analysis(
                child,
                imports=imports,
                classes=classes,
                functions=functions,
                calls=calls,
                parent_symbol=child_parent,
                current_symbol=child_current,
            )

    def _extract_import(
        self,
        node,
        imports: List[Dict[str, Any]],
    ) -> None:
        source_node = node.child_by_field_name("source")

        if source_node is None:
            return

        module = self._node_text(source_node).strip("'\"")
        text = self._node_text(node)

        imported_name = None
        alias = None

        # import { foo } from "./module"
        import_clause = node.child_by_field_name("import")

        if import_clause is not None:
            clause_text = self._node_text(import_clause)

            if "{" in clause_text and "}" in clause_text:
                inner = clause_text.split("{", 1)[1].split("}", 1)[0].strip()

                if inner:
                    first_import = inner.split(",", 1)[0].strip()

                    if " as " in first_import:
                        imported_name, alias = [
                            value.strip()
                            for value in first_import.split(" as ", 1)
                        ]
                    else:
                        imported_name = first_import

            elif clause_text and not clause_text.startswith("from"):
                imported_name = clause_text.split(",", 1)[0].strip()

        imports.append(
            {
                "module": module,
                "imported_name": imported_name or module,
                "alias": alias,
                "start_line": self._line(node),
                "end_line": self._end_line(node),
                "statement": text,
            }
        )

    def _extract_call(
        self,
        node,
        calls: List[Dict[str, Any]],
        current_symbol: Optional[str],
    ) -> None:
        function_node = node.child_by_field_name("function")

        if function_node is None:
            return

        target_name = self._call_target_name(function_node)

        if not target_name:
            return

        calls.append(
            {
                "target_name": target_name,
                "caller_symbol": current_symbol,
                "file_path": str(self.file_path),
                "start_line": self._line(node),
                "end_line": self._end_line(node),
            }
        )

    def _call_target_name(self, node) -> Optional[str]:
        if node.type == "identifier":
            return self._node_text(node)

        if node.type in {
            "member_expression",
            "optional_member_expression",
        }:
            property_node = node.child_by_field_name("property")

            if property_node is not None:
                return self._node_text(property_node)

        return None