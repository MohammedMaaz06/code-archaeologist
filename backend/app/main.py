from fastapi import FastAPI

from app.api.endpoints import search
from app.api.v1 import graph, health, archeology, llm, repositories, search as v1_search, symbols

app = FastAPI(
    title="Code Archaeologist API",
    version="0.1.0",
    description="AST, Symbol Resolution, Vector Search, and Code Graph Analysis Service",
)


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "Code Archaeologist API",
        "status": "ok",
    }


# Existing search endpoint
app.include_router(search.router)


# Versioned API
app.include_router(health.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1/graph", tags=["Graph"])
app.include_router(archeology.router, prefix="/api/v1")
app.include_router(llm.router, prefix="/api/v1")
app.include_router(repositories.router, prefix="/api/v1")
app.include_router(v1_search.router, prefix="/api/v1")
app.include_router(symbols.router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "code-archaeologist-backend",
    }