from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ExplanationRequest(BaseModel):
    symbol_name: str
    code_snippet: str
    mode: str = "summary"

@router.post("/api/explain")
async def explain_code(req: ExplanationRequest):
    return {
        "status": "success",
        "symbol": req.symbol_name,
        "mode": req.mode,
        "explanation": f"AI Explanation generated for {req.symbol_name} in {req.mode} mode."
    }
