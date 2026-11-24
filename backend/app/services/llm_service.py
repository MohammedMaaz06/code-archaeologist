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
        self.api_url = api_url or "https://api.groq.com/openai/v1/chat/completions"
        self.api_key = (
            settings.GROQ_API_KEY.get_secret_value()
            if settings.GROQ_API_KEY
            else None
        )
        self.model = settings.GROQ_MODEL

    def _generate_completion(self, prompt: str, timeout: int) -> Optional[str]:
        if not self.api_key:
            logger.warning("Groq API key is not configured; using repository evidence fallback.")
            return None

        payload = json.dumps({
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }).encode("utf-8")
        req = urllib.request.Request(
            self.api_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )

        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status != 200:
                return None
            data = json.loads(response.read().decode("utf-8"))
        choices = data.get("choices", [])
        if not choices:
            return None
        message = choices[0].get("message", {})
        content = message.get("content")
        return content.strip() if isinstance(content, str) and content.strip() else None

    def generate_explanation(self, context_digest: Dict[str, Any]) -> str:
        chunks = context_digest.get("matched_chunks", [])
        if not chunks:
            return self._fallback_summary(context_digest)

        prompt = self._build_prompt(context_digest)

        if self.api_key:
            try:
                explanation = self._generate_completion(prompt, timeout=120)
                if (
                    explanation
                    and "```" not in explanation
                    and self._has_valid_citations(explanation, chunks)
                ):
                    return explanation
                logger.info(
                    "Groq returned no explanation with valid repository citations; "
                    "trying local Ollama."
                )
            except Exception as e:
                logger.info(
                    "Groq LLM service unavailable (%s). Trying local Ollama.",
                    str(e),
                )

        try:
            explanation = self._generate_ollama_completion(prompt, timeout=120)
            if (
                explanation
                and "```" not in explanation
                and self._has_valid_citations(explanation, chunks)
            ):
                return explanation
            logger.info(
                "Ollama returned no explanation with valid repository citations."
            )
        except Exception as e:
            logger.info("Local Ollama service unavailable (%s).", str(e))

        return self._fallback_summary(context_digest)

    def _generate_ollama_completion(
        self,
        prompt: str,
        timeout: int,
    ) -> Optional[str]:
        ollama_host = settings.OLLAMA_HOST.rstrip("/")
        model = settings.OLLAMA_MODEL
        payload = json.dumps({
            "model": model,
            "prompt": prompt,
            "stream": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{ollama_host}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
        )

        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status != 200:
                return None
            data = json.loads(response.read().decode("utf-8"))
        explanation = data.get("response")
        return (
            explanation.strip()
            if isinstance(explanation, str) and explanation.strip()
            else None
        )

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
        """Generate a corrected version of source code using Groq."""
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
            corrected_code = self._generate_completion(prompt, timeout=60)
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
                    "model": self.model,
                    **validation,
                }

        except Exception as e:
            logger.info("Groq LLM code-fix service unavailable (%s).", str(e))

        return {
            "status": "unavailable",
            "original_code": source_code,
            "corrected_code": None,
            "diff": "",
            "changed": False,
            "model": self.model,
        }

    def _build_prompt(self, context_digest: Dict[str, Any]) -> str:
        query = context_digest.get("query", "Code Analysis")
        chunks = context_digest.get("matched_chunks", [])
        deps = context_digest.get("dependency_context", {})

        prompt = (
            "Answer the user's question directly and accurately using only the repository "
            "evidence below. Keep the answer concise: usually 1-3 sentences and no more "
            "than 100 words unless the user explicitly asks for detail. Do not add a generic "
            "introduction, repeat the question, or include unrelated observations. Never "
            "guess or rely on prior knowledge. If the evidence is insufficient to answer, "
            "say exactly what could not be determined from the retrieved code. Cite every "
            "repository-specific factual claim with the exact format [path/to/file:START-END], "
            "using only paths and line ranges present in the supplied evidence. Do not cite "
            "any other source. Write a plain-language explanation in sentences only. Never "
            "output source code, code snippets, fenced blocks, raw evidence listings, or a "
            "report-style heading. Even when asked to explain code, describe what it does "
            "instead of reproducing it.\n\n"
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
        chunks = context_digest.get("matched_chunks", [])
        if chunks:
            source = chunks[0]
            file_path = source.get("file_path")
            lines = source.get("lines")
            citation = f" [{file_path}:{lines}]" if file_path and lines else ""
            return (
                "I found relevant source code, but could not produce a reliable explanation "
                f"for it right now.{citation}"
            )

        return (
            "I couldn't find relevant source code for this question. Try asking about a "
            "specific symbol, file, or behavior, or scan and index the repository."
        )
