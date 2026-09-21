from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from app.api.v1.health import router as health_router
from app.api.v1.repositories import router as repositories_router
from app.api.v1.symbols import router as symbols_router
from app.api.v1.graph import router as graph_router
from app.api.v1.search import router as search_router
from app.core.config import settings
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging(debug=settings.DEBUG)
    logger.info(
        "Starting application",
        project_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )
    yield
    logger.info("Shutting down application")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.include_router(health_router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(repositories_router, prefix=f"{settings.API_V1_STR}/repositories", tags=["Repositories"])
app.include_router(symbols_router, prefix=f"{settings.API_V1_STR}/symbols", tags=["Symbols"])
app.include_router(graph_router, prefix=f"{settings.API_V1_STR}/graph", tags=["Graph"])
app.include_router(search_router, prefix=f"{settings.API_V1_STR}/search", tags=["Search"])


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} Engine",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
    }
