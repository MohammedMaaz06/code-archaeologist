from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.graph_service import DependencyGraphService
from app.services.vector_service import VectorSearchService
from app.services.archeology_service import ArcheologyEngine
from app.api.v1.graph import graph_service
from app.api.v1.search import vector_service

router = APIRouter()
archeology_engine = ArcheologyEngine(graph_service=graph_service, vector_service=vector_service)


class InvestigateRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3


class ImpactRequest(BaseModel):
    target_file: str


@router.post("/investigate")
async def investigate_codebase(request: InvestigateRequest):
    try:
        report = archeology_engine.investigate(query=request.query, top_k=request.top_k or 3)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Archeology investigation failed: {str(e)}")


@router.post("/impact")
async def analyze_file_impact(request: ImpactRequest):
    try:
        impact = archeology_engine.analyze_impact(target_file=request.target_file)
        return impact
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impact analysis failed: {str(e)}")
