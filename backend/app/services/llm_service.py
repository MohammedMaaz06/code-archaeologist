import ast
import difflib
import json
import re
import urllib.request
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import logger


class LLMService:
    _citation_pattern = re.compile(r"\[([^\[\]]+):(\d+)(?:-(\d+))?\]")

    def __init__(self, api_url: Optional[str] = None):
        self.api_url = api_url or "http://localhost:11434/api/generate"

    def generate_explanation(self, context_digest: Dict[str, Any]) -> str:
        chunks = context_digest.get("matched_chunks", [])
        if not chunks:
            return self._fallback_summary(context_digest)

        prompt = self._build_prompt(context_digest)

        try:
            payload = json.dumps({
                "model": "codellama:instruct",
                "prompt": prompt,
                "stream": False
            }).encode("utf-8")

            req = urllib.request.Request(
                self.api_url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )

            with urllib.request.urlopen(req, timeout=120) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    explanation = data.get("response", "").strip()
                    if explanation and self._has_valid_citations(explanation, chunks):
                        return explanation
        except Exception as e:
            logger.info(
                "Local LLM service unavailable (%s). Falling back to repository evidence.",
                str(e),
            )

        return self._fallback_summary(context_digest)

    @classmethod
    def _has_valid_citations(
        cls,
        explanation: str,
        chunks: list[Dict[str, Any]],
    ) -> bool:
        citations = cls._citation_pattern.findall(explanation)
        if not citations:
            return False

        available_ranges: Dict[str, list[tuple[int, int]]] = {}
        for chunk in chunks:
            lines = chunk.get("lines", "")
            match = re.fullmatch(r"\s*(\d+)-(\d+)\s*", str(lines))
            if match and chunk.get("file_path"):
                available_ranges.setdefault(str(chunk["file_path"]), []).append(
                    (int(match.group(1)), int(match.group(2)))
                )

        for file_path, start_text, end_text in citations:
            start = int(start_text)
            end = int(end_text or start_text)
            if start > end:
                return False
            if not any(
                start >= available_start and end <= available_end
                for available_start, available_end in available_ranges.get(file_path, [])
            ):
                return False

        return True

    def _validate_generated_code(
        self,
        code: str,
        language: str,
    ) -> Dict[str, Any]:
        """Validate generated code when a parser is available."""
        normalized_language = language.strip().lower()

        if normalized_language in {"python", "py"}:
            try:
                ast.parse(code)
                return {
                    "validation_status": "passed",
                    "validation_message": "Python syntax is valid.",
                }
            except SyntaxError as exc:
                return {
                    "validation_status": "failed",
                    "validation_message": f"Python syntax error: {exc}",
                }

        return {
            "validation_status": "skipped",
            "validation_message": f"No built-in validator configured for {language}.",
        }

    def generate_code_fix(
        self,
        source_code: str,
        issue: str,
        language: str = "python",
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a corrected version of source code using the local LLM."""
        prompt = (
            "You are a careful software engineer fixing an existing codebase.\n\n"
            f"Language: {language}\n"
            f"Issue: {issue}\n\n"
            "Code to fix:\n"
            "```\n"
            f"{source_code}\n"
            "```\n\n"
        )

        if context:
            prompt += f"Additional context:\n{context}\n\n"

        prompt += (
            "Return the corrected code only. "
            "Do not include Markdown fences, explanations, or commentary. "
            "Preserve the existing behavior except where the issue requires a change."
        )

        try:
            payload = json.dumps({
                "model": "llama3.2:latest",
                "prompt": prompt,
                "stream": False
            }).encode("utf-8")

            req = urllib.request.Request(
                self.api_url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )

            with urllib.request.urlopen(req, timeout=60) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    corrected_code = data.get("response", "").strip()

                    if corrected_code:
                        if corrected_code.startswith("```"):
                            lines = corrected_code.splitlines()

                            if lines and lines[0].strip().startswith("```"):
                                lines = lines[1:]

                            if lines and lines[-1].strip() == "```":
                                lines = lines[:-1]

                            corrected_code = "\n".join(lines).strip()

                        original_lines = [
                            f"{line}\n"
                            for line in source_code.splitlines()
                        ]
                        corrected_lines = [
                            f"{line}\n"
                            for line in corrected_code.splitlines()
                        ]

                        diff = "".join(
                            difflib.unified_diff(
                                original_lines,
                                corrected_lines,
                                fromfile="original",
                                tofile="corrected",
                            )
                        )

                        validation = self._validate_generated_code(
                            corrected_code,
                            language,
                        )

                        status = (
                            "validation_failed"
                            if validation["validation_status"] == "failed"
                            else "success"
                        )

                        return {
                            "status": status,
                            "original_code": source_code,
                            "corrected_code": corrected_code,
                            "diff": diff,
                            "changed": source_code != corrected_code,
                            "model": "llama3.2:latest",
                            **validation,
                        }

        except Exception as e:
            logger.info(f"Local LLM code-fix service unavailable ({str(e)}).")

        return {
            "status": "unavailable",
            "original_code": source_code,
            "corrected_code": None,
            "diff": "",
            "changed": False,
            "model": "llama3.2:latest",
        }

    def _build_prompt(self, context_digest: Dict[str, Any]) -> str:
        query = context_digest.get("query", "Code Analysis")
        chunks = context_digest.get("matched_chunks", [])
        deps = context_digest.get("dependency_context", {})

        prompt = (
            "Answer the user's question using only the repository evidence below. "
            "Do not rely on prior knowledge, assume a repository identity, or invent "
            "files, modules, functions, dependencies, or behavior. If the evidence "
            "does not answer the question, say so clearly. Cite every repository-specific "
            "factual claim using the exact format [path/to/file:START-END], where the "
            "path and line range appear in the supplied evidence. Do not cite any other "
            "source.\n\n"
            f"Question: {query}\n\n"
            "Retrieved repository evidence:\n"
        )
        for c in chunks:
            prompt += (
                f"--- {c.get('file_path')}:{c.get('lines')} "
                f"({c.get('symbol_name') or 'source'}, score {c.get('score', 'unknown')}) ---\n"
                f"{c.get('content', '')}\n\n"
            )

        prompt += f"Repository dependency evidence: {json.dumps(deps)}\n"
        return prompt

    def _fallback_summary(self, context_digest: Dict[str, Any]) -> str:
        query = context_digest.get("query", "Query")
        files = context_digest.get("relevant_files", [])
        chunks = context_digest.get("matched_chunks", [])

        summary = f"### Code Analysis Report for '{query}'\n\n"
        summary += f"**Relevant Files**: {', '.join(files) if files else 'None'}\n\n"
        summary += "**Key Identified Symbols & Code Regions**:\n"
        for c in chunks:
            summary += f"- **{c.get('symbol_name', 'Block')}** in `{c.get('file_path')}` (Lines {c.get('lines')})\n"
            content = c.get("content", "").strip()
            if content:
                summary += f"\n  ```\n  {content}\n  ```\n"

        if chunks:
            summary += (
                "\n**Evidence note**: This is a listing of retrieved repository evidence, "
                "not a verified explanation. No unsupported architecture or project details "
                "are inferred."
            )
        else:
            summary += (
                "\n**Evidence note**: No relevant source snippets were retrieved, so this "
                "question cannot be answered from the indexed repository. Scan and index "
                "the repository, then try again."
            )
        return summary
