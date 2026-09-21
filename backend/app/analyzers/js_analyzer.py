import re
from pathlib import Path
from typing import List, Optional
from app.analyzers.python_analyzer import ExtractedSymbol


class JSTSAnalyzer:
    def __init__(self, file_path: Path, source_code: Optional[str] = None):
        self.file_path = file_path
        self.source_code = source_code or file_path.read_text(encoding="utf-8", errors="ignore")

    def extract_symbols(self) -> List[ExtractedSymbol]:
        symbols: List[ExtractedSymbol] = []
        lines = self.source_code.splitlines()

        for idx, line in enumerate(lines, start=1):
            line_str = line.strip()

            func_match = re.search(r'(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)', line_str)
            if func_match:
                func_name = func_match.group(1)
                args = func_match.group(2)
                symbols.append(
                    ExtractedSymbol(
                        name=func_name,
                        kind="function",
                        start_line=idx,
                        end_line=idx,
                        signature=f"function {func_name}({args})",
                    )
                )

            class_match = re.search(r'class\s+([a-zA-Z0-9_]+)', line_str)
            if class_match:
                class_name = class_match.group(1)
                symbols.append(
                    ExtractedSymbol(
                        name=class_name,
                        kind="class",
                        start_line=idx,
                        end_line=idx,
                        signature=f"class {class_name}",
                    )
                )

            import_match = re.search(r'import\s+.*?from\s+[\'"]([^\'"]+)[\'"]', line_str)
            if import_match:
                symbols.append(
                    ExtractedSymbol(
                        name=import_match.group(1),
                        kind="import",
                        start_line=idx,
                        end_line=idx,
                        signature=line_str,
                    )
                )

        return symbols
