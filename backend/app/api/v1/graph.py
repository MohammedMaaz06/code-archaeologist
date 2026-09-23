from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
from app.services.graph_service import GraphService

router = APIRouter()
graph_service = GraphService()

@router.get("/export", response_model=Dict[str, Any])
def export_graph():
    """Exports the full code graph nodes and edges for Cytoscape/3D visualization."""
    return graph_service.export_graph()

@router.get("/callers", response_model=Dict[str, Any])
def get_callers(symbol_id: str = Query(..., description="Full symbol ID to query callers for")):
    """Returns all caller functions for a given symbol."""
    callers = graph_service.get_callers(symbol_id)
    return {"symbol_id": symbol_id, "callers": callers}

@router.get("/callees", response_model=Dict[str, Any])
def get_callees(symbol_id: str = Query(..., description="Full symbol ID to query callees for")):
    """Returns all functions called by a given symbol."""
    callees = graph_service.get_callees(symbol_id)
    return {"symbol_id": symbol_id, "callees": callees}

@router.get("/blast-radius", response_model=Dict[str, Any])
def get_blast_radius(
    symbol_id: str = Query(..., description="Target symbol ID to calculate blast radius for"),
    max_depth: int = Query(3, ge=1, le=10, description="Max depth of upstream caller traversal")
):
    """Calculates the impact/blast radius when a specific symbol is changed."""
    impact = graph_service.get_blast_radius(symbol_id, max_depth=max_depth)
    return {"symbol_id": symbol_id, **impact}