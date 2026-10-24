from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import search
from app.api.v1 import archeology, graph, health, llm, repositories, search as v1_search, symbols
from app.core.config import settings

app = FastAPI(
    title="Code Archaeologist API",
    version=settings.VERSION,
    description="AST, Symbol Resolution, Vector Search, and Code Graph Analysis Service",
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
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