import json
import urllib.request
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import logger


class LLMService:
    def __init__(self, api_url: Optional[str] = None):
        self.api_url = api_url or "http://localhost:11434/api/generate"

    def generate_explanation(self, context_digest: Dict[str, Any]) -> str:
        prompt = self._build_prompt(context_digest)
        
        # Try calling local LLM endpoint (Ollama style) with a short timeout
        try:
            payload = json.dumps({
                "model": "codellama",
                "prompt": prompt,
                "stream": False
            }).encode("utf-8")

            req = urllib.request.Request(
                self.api_url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )

            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    return data.get("response", self._fallback_summary(context_digest))
        except Exception as e:
            logger.info(f"Local LLM service unavailable ({str(e)}). Falling back to deterministic context summary.")

        return self._fallback_summary(context_digest)

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
                "model": "codellama",
                "prompt": prompt,
                "stream": False
            }).encode("utf-8")

            req = urllib.request.Request(
                self.api_url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )

            with urllib.request.urlopen(req, timeout=10) as response:
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

                        return {
                            "status": "success",
                            "corrected_code": corrected_code,
                            "model": "codellama",
                        }

        except Exception as e:
            logger.info(f"Local LLM code-fix service unavailable ({str(e)}).")

        return {
            "status": "unavailable",
            "corrected_code": None,
            "model": "codellama",
        }

    def _build_prompt(self, context_digest: Dict[str, Any]) -> str:
        query = context_digest.get("query", "Code Analysis")
        chunks = context_digest.get("matched_chunks", [])
        deps = context_digest.get("dependency_context", {})

        prompt = f"Analyze the following codebase query: '{query}'\n\n"
        prompt += "Code Snippets:\n"
        for c in chunks:
            prompt += f"--- {c.get('file_path')} ({c.get('symbol_name')}) ---\n{c.get('content')}\n\n"

        prompt += f"Dependencies Context: {json.dumps(deps)}\n"
        prompt += "\nProvide a clear architectural explanation and potential refactoring risks."
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
        
        summary += "\n**Architectural Insight**: "
        summary += f"Target spans {len(files)} file(s). Review graph dependency boundaries before refactoring."
        return summary
