from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm_service import LLMService
from app.api.v1.archeology import archeology_engine

router = APIRouter()
llm_service = LLMService()


class ExplainRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3


class RefactorRiskRequest(BaseModel):
    target_file: str


@router.post("/explain")
async def explain_code(request: ExplainRequest):
    try:
        # Step 1: Synthesize context using ArcheologyEngine
        context_digest = archeology_engine.investigate(query=request.query, top_k=request.top_k or 3)
        
        # Step 2: Generate natural language response via LLM service
        explanation = llm_service.generate_explanation(context_digest)

        return {
            "query": request.query,
            "explanation": explanation,
            "raw_context": context_digest
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Explanation failed: {str(e)}")


@router.post("/refactor-risk")
async def refactor_risk_assessment(request: RefactorRiskRequest):
    try:
        impact = archeology_engine.analyze_impact(target_file=request.target_file)
        
        risk_report = (
            f"### Refactoring Risk Report: `{impact['target_file']}`\n"
            f"- **Risk Level**: {impact['risk_level']}\n"
            f"- **Blast Radius Score**: {impact['blast_radius_score']} direct dependent file(s)\n"
            f"- **Affected Downstream Files**: {', '.join(impact['affected_files']) if impact['affected_files'] else 'None'}\n\n"
            f"**Recommendation**: Verify all unit tests for direct dependent files prior to changing public function signatures."
        )

        return {
            "target_file": request.target_file,
            "impact_metrics": impact,
            "risk_report": risk_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refactor risk calculation failed: {str(e)}")
