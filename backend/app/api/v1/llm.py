from pathlib import Path
import hashlib
import json
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

        impact_analysis = None
        llm_context = request.context

        if request.repo_path and request.file_path:
            try:
                impact_analysis = archeology_engine.analyze_impact(
                    target_file=request.file_path
                )

                impact_context = (
                    "Repository impact analysis for the target file:\n"
                    f"{json.dumps(impact_analysis, indent=2)}"
                )

                if llm_context:
                    llm_context = f"{llm_context}\n\n{impact_context}"
                else:
                    llm_context = impact_context

            except Exception:
                impact_analysis = {
                    "target_file": request.file_path,
                    "available": False,
                    "message": "Impact analysis unavailable for this file.",
                }

        result = llm_service.generate_code_fix(
            source_code=source_code,
            issue=request.issue,
            language=language,
            context=llm_context,
        )

        original_sha256 = hashlib.sha256(
            source_code.encode("utf-8")
        ).hexdigest()

        response = {
            "issue": request.issue,
            "language": language,
            "file_path": request.file_path,
            "original_sha256": original_sha256,
            **result,
        }

        if impact_analysis is not None:
            response["impact_analysis"] = impact_analysis

        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code fix generation failed: {str(e)}")


class ApplyCodeFixRequest(BaseModel):
    repo_path: str
    file_path: str
    expected_sha256: str
    corrected_code: str
    language: Optional[str] = None


def _resolve_repository_file(repo_path: str, file_path: str) -> Path:
    repo_root = Path(repo_path).resolve()
    target_file = (repo_root / file_path).resolve()

    if not repo_root.exists() or not repo_root.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Invalid repository path: {repo_path}",
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
            detail=f"File not found: {file_path}",
        )

    return target_file


@router.post("/apply-code-fix")
async def apply_code_fix(request: ApplyCodeFixRequest) -> Dict[str, Any]:
    target_file = _resolve_repository_file(
        request.repo_path,
        request.file_path,
    )

    current_code = target_file.read_text(
        encoding="utf-8",
        errors="ignore",
    )

    current_sha256 = hashlib.sha256(
        current_code.encode("utf-8")
    ).hexdigest()

    if current_sha256 != request.expected_sha256:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "File changed since the fix was generated.",
                "expected_sha256": request.expected_sha256,
                "current_sha256": current_sha256,
            },
        )

    language = request.language

    if not language:
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

    validation = llm_service._validate_generated_code(
        request.corrected_code,
        language,
    )

    if validation["validation_status"] == "failed":
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Corrected code failed validation.",
                "validation_status": validation["validation_status"],
                "validation_message": validation["validation_message"],
            },
        )

    target_file.write_text(
        request.corrected_code,
        encoding="utf-8",
    )

    new_sha256 = hashlib.sha256(
        request.corrected_code.encode("utf-8")
    ).hexdigest()

    return {
        "status": "applied",
        "file_path": request.file_path,
        "previous_sha256": current_sha256,
        "new_sha256": new_sha256,
        **validation,
    }


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
