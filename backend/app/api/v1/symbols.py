from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.analyzers.python_analyzer import PythonASTAnalyzer
from app.analyzers.js_analyzer import JSTSAnalyzer

router = APIRouter()


class SymbolExtractionRequest(BaseModel):
    file_path: str


class ExtractedSymbolDTO(BaseModel):
    name: str
    kind: str
    start_line: int
    end_line: int
    parent_symbol: Optional[str] = None
    signature: Optional[str] = None


@router.post("/extract", response_model=List[ExtractedSymbolDTO])
async def extract_symbols(request: SymbolExtractionRequest):
    p = Path(request.file_path).resolve()
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=400, detail=f"File not found: {request.file_path}")

    ext = p.suffix.lower()
    symbols = []

    if ext == ".py":
        analyzer = PythonASTAnalyzer(p)
        symbols = analyzer.extract_symbols()
    elif ext in [".js", ".jsx", ".ts", ".tsx"]:
        analyzer = JSTSAnalyzer(p)
        symbols = analyzer.extract_symbols()
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")

    return [
        ExtractedSymbolDTO(
            name=s.name,
            kind=s.kind,
            start_line=s.start_line,
            end_line=s.end_line,
            parent_symbol=s.parent_symbol,
            signature=s.signature,
        )
        for s in symbols
    ]
