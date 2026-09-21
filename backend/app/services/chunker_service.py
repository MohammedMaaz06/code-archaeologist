from pathlib import Path
from typing import List, Dict, Any, Optional


class CodeChunk:
    def __init__(
        self,
        chunk_id: str,
        file_path: str,
        symbol_name: Optional[str],
        content: str,
        start_line: int,
        end_line: int,
        language: str,
    ):
        self.chunk_id = chunk_id
        self.file_path = file_path
        self.symbol_name = symbol_name
        self.content = content
        self.start_line = start_line
        self.end_line = end_line
        self.language = language

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "file_path": self.file_path,
            "symbol_name": self.symbol_name,
            "content": self.content,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "language": self.language,
        }


class CodeChunker:
    @staticmethod
    def chunk_file(
        file_path: str,
        source_code: str,
        symbols: List[Dict[str, Any]],
        language: str,
        max_chunk_lines: int = 50,
    ) -> List[CodeChunk]:
        chunks: List[CodeChunk] = []
        lines = source_code.splitlines()
        total_lines = len(lines)

        if not lines:
            return chunks

        # Filter functional symbols (classes and functions)
        code_symbols = [
            s for s in symbols
            if s.get("kind") in ["function", "class", "method"]
        ]

        if not code_symbols:
            # Fallback to standard line window chunking if no symbols found
            for i in range(0, total_lines, max_chunk_lines):
                chunk_lines = lines[i : i + max_chunk_lines]
                content = "\n".join(chunk_lines)
                chunks.append(
                    CodeChunk(
                        chunk_id=f"{file_path}:{i+1}-{min(i+max_chunk_lines, total_lines)}",
                        file_path=file_path,
                        symbol_name=None,
                        content=content,
                        start_line=i + 1,
                        end_line=min(i + max_chunk_lines, total_lines),
                        language=language,
                    )
                )
            return chunks

        # Syntax-aware chunking based on AST symbol boundaries
        for idx, sym in enumerate(code_symbols):
            s_line = max(1, sym.get("start_line", 1))
            e_line = min(total_lines, sym.get("end_line", s_line))
            
            chunk_content = "\n".join(lines[s_line - 1 : e_line])
            if chunk_content.strip():
                chunks.append(
                    CodeChunk(
                        chunk_id=f"{file_path}::{sym.get('name')}#{s_line}-{e_line}",
                        file_path=file_path,
                        symbol_name=sym.get("name"),
                        content=chunk_content,
                        start_line=s_line,
                        end_line=e_line,
                        language=language,
                    )
                )

        return chunks
