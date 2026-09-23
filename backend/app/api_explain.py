import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class ExplanationRequest(BaseModel):
    symbol_name: str
    code_snippet: str
    mode: Optional[str] = "summary"  # Options: summary, complexity, security

@router.post("/api/explain")
async def explain_code(req: ExplanationRequest):
    """
    Calls an LLM (OpenAI API or compatible endpoint) to generate dynamic explanations,
    complexity breakdown, or security audits for a code snippet.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    api_base = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    model_name = os.getenv("LLM_MODEL", "gpt-4o-mini")

    if not api_key:
        # Fallback explanation if API key is not yet set in environment
        return {
            "status": "warning",
            "symbol": req.symbol_name,
            "mode": req.mode,
            "explanation": (
                f"**[Demo Mode - OPENAI_API_KEY missing]**\n\n"
                f"**Target Symbol:** `{req.symbol_name}`\n"
                f"**Requested Mode:** `{req.mode}`\n\n"
                "Please set `OPENAI_API_KEY` in your `.env` file to enable live LLM synthesis."
            )
        }

    # Custom system prompts per requested mode
    system_prompts = {
        "summary": (
            "You are an expert code archaeologist and senior staff software engineer. "
            "Explain the functional role, key steps, and operational flow of the provided code snippet concise and formatted with clean Markdown bolding and bullet points."
        ),
        "complexity": (
            "You are an algorithm and performance engineer. "
            "Analyze the provided code snippet for Time Complexity (Big-O) and Space Complexity (Big-O). "
            "Provide explicit asymptotic reasoning and rate its maintainability score."
        ),
        "security": (
            "You are a application security engineer performing a static code audit. "
            "Examine the provided snippet for vulnerability vectors (e.g., injection, unhandled exceptions, buffer/resource leaks) and suggest concrete remediation steps."
        )
    }

    prompt_mode = req.mode.lower() if req.mode else "summary"
    system_prompt = system_prompts.get(prompt_mode, system_prompts["summary"])

    user_prompt = f"Symbol: `{req.symbol_name}`\n\nCode Snippet:\n```python\n{req.code_snippet}\n```"

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key, base_url=api_base)

        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=600
        )

        content = response.choices[0].message.content

        return {
            "status": "success",
            "symbol": req.symbol_name,
            "mode": req.mode,
            "explanation": content
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM API request failed: {str(e)}"
        )
