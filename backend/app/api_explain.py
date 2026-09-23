import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class ExplanationRequest(BaseModel):
    symbol_name: str
    code_snippet: str
    mode: Optional[str] = "summary"  # summary, complexity, security

@router.post("/api/explain")
async def explain_code(req: ExplanationRequest):
    """
    Calls local Ollama instance (default: http://localhost:11434) to generate dynamic 
    explanations, Big-O complexity analysis, or security audits for code snippets.
    """
    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    model_name = os.getenv("OLLAMA_MODEL", "llama3")

    system_prompts = {
        "summary": (
            "You are an expert code archaeologist. Explain the functional role, key steps, "
            "and operational flow of the provided code snippet concisely using clean Markdown."
        ),
        "complexity": (
            "You are an algorithms engineer. Analyze the provided code for Time Complexity (Big-O) "
            "and Space Complexity (Big-O). Provide asymptotic reasoning and a maintainability rating."
        ),
        "security": (
            "You are an application security engineer. Perform a static security check on the code snippet. "
            "Identify potential vulnerability vectors and suggest concrete remediation steps."
        )
    }

    prompt_mode = req.mode.lower() if req.mode else "summary"
    system_prompt = system_prompts.get(prompt_mode, system_prompts["summary"])

    prompt = (
        f"{system_prompt}\n\n"
        f"Symbol Name: {req.symbol_name}\n"
        f"Code Snippet:\n```python\n{req.code_snippet}\n```"
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                f"{ollama_host}/api/generate",
                json={
                    "model": model_name,
                    "prompt": prompt,
                    "stream": False
                }
            )

            if res.status_code != 200:
                raise HTTPException(
                    status_code=500,
                    detail=f"Ollama returned status {res.status_code}. Make sure Ollama is running (`ollama serve`)."
                )

            data = res.json()
            explanation_text = data.get("response", "No response received from local Ollama model.")

            return {
                "status": "success",
                "symbol": req.symbol_name,
                "mode": req.mode,
                "model": model_name,
                "explanation": explanation_text
            }

    except httpx.ConnectError:
        return {
            "status": "warning",
            "symbol": req.symbol_name,
            "mode": req.mode,
            "explanation": (
                f"**⚠️ Cannot connect to local Ollama instance at `{ollama_host}`**\n\n"
                "Please make sure Ollama is installed and running:\n"
                "1. Start server: `ollama serve`\n"
                "2. Pull model: `ollama pull llama3` (or `qwen2.5`)\n"
                "3. Retry generating the explanation."
            )
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ollama API request failed: {str(e)}"
        )
