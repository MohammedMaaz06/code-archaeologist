from pathlib import Path
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


class CodeFixRequest(BaseModel):
    issue: str
    source_code: Optional[str] = None
    repo_path: Optional[str] = None
    file_path: Optional[str] = None
    language: Optional[str] = None
    context: Optional[str] = None


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


@router.post("/code-fix")
async def code_fix(request: CodeFixRequest):
    try:
        source_code = request.source_code
        language = request.language or "python"

        if request.repo_path or request.file_path:
            if not request.repo_path or not request.file_path:
                raise HTTPException(
                    status_code=400,
                    detail="repo_path and file_path must be provided together.",
                )

            repo_root = Path(request.repo_path).resolve()
            target_file = (repo_root / request.file_path).resolve()

            if not repo_root.exists() or not repo_root.is_dir():
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid repository path: {request.repo_path}",
                )

            try:
                target_file.relative_to(repo_root)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="file_path must point inside repo_path.",
                )

            if not target_file.exists() or not target_file.is_file():
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {request.file_path}",
                )

            source_code = target_file.read_text(encoding="utf-8", errors="ignore")

            if not request.language:
                language_map = {
                    ".py": "python",
                    ".js": "javascript",
                    ".jsx": "javascript",
                    ".ts": "typescript",
                    ".tsx": "typescript",
                }
                language = language_map.get(
                    target_file.suffix.lower(),
                    "text",
                )

        if not source_code:
            raise HTTPException(
                status_code=400,
                detail="Provide source_code or repo_path with file_path.",
            )

        result = llm_service.generate_code_fix(
            source_code=source_code,
            issue=request.issue,
            language=language,
            context=request.context,
        )

        return {
            "issue": request.issue,
            "language": language,
            "file_path": request.file_path,
            **result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code fix generation failed: {str(e)}")


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
