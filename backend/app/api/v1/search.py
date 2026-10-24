from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.chunker_service import CodeChunker
from app.services.vector_service import VectorSearchService
from app.services.repository_state import get_or_create_vector_service, get_vector_service

router = APIRouter()
vector_service = VectorSearchService()


class FileContentPayload(BaseModel):
    file_path: str
    source_code: str
    language: str
    symbols: List[Dict[str, Any]] = []


class IndexRequest(BaseModel):
    files: List[FileContentPayload]
    repository_path: Optional[str] = None


class SearchQueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    repository_path: Optional[str] = None


@router.post("/index")
async def index_repository_code(request: IndexRequest):
    try:
        index_service = (
            get_or_create_vector_service(request.repository_path)
            if request.repository_path
            else vector_service
        )
        index_service.clear()
        total_chunks = 0

        for f in request.files:
            chunks = CodeChunker.chunk_file(
                file_path=f.file_path,
                source_code=f.source_code,
                symbols=f.symbols,
                language=f.language
            )
            index_service.index_chunks(chunks)
            total_chunks += len(chunks)

        return {
            "status": "success",
            "files_indexed": len(request.files),
            "total_chunks_indexed": total_chunks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index code: {str(e)}")


@router.post("/query")
async def query_code(request: SearchQueryRequest):
    try:
        query_service = (
            get_vector_service(request.repository_path)
            if request.repository_path
            else vector_service
        )
        results = (
            query_service.query(request.query, top_k=request.top_k or 5)
            if query_service
            else []
        )
        return {
            "query": request.query,
            "total_matches": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
