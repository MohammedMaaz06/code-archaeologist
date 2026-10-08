from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import search
from app.api.v1 import graph, health, archeology, llm, repositories, search as v1_search, symbols

app = FastAPI(
    title="Code Archaeologist API",
    version="0.1.0",
    description="AST, Symbol Resolution, Vector Search, and Code Graph Analysis Service",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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