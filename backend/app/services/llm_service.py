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
