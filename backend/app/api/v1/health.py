from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    project_name: str
    version: str
    environment: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        project_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )
