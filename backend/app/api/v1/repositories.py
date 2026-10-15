from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.git_service import GitService
from app.services.repository_analysis_service import RepositoryAnalysisService
from app.services.repository_source_service import RepositorySourceError, RepositorySourceService
from app.api.v1.graph import graph_service

router = APIRouter()

# In-memory session database store for Phase 2 before DB migrations
_IN_MEMORY_REPOS = {}


class ScanRepoRequest(BaseModel):
    path: Optional[str] = Field(
        default=None,
        description="Absolute path to a local repository on the backend machine",
    )
    repo_url: Optional[str] = Field(
        default=None,
        description="Public HTTPS Git URL from GitHub, GitLab, or Bitbucket",
    )


class FileIndexDTO(BaseModel):
    relative_path: str
    extension: str
    language: str
    size_bytes: int
    loc: int
    sha256: str


class RepositoryDTO(BaseModel):
    id: str
    name: str
    path: str
    default_branch: Optional[str] = None
    head_commit: Optional[str] = None
    head_commit_message: Optional[str] = None
    head_commit_author: Optional[str] = None
    total_files: int
    total_loc: int
    files: List[FileIndexDTO] = []


@router.post("/scan", response_model=RepositoryDTO)
async def scan_repository(request: ScanRepoRequest):
    local_path = (request.path or "").strip()
    repo_url = (request.repo_url or "").strip()

    if bool(local_path) == bool(repo_url):
        raise HTTPException(
            status_code=400,
            detail="Provide exactly one source: 'path' for a local repository or 'repo_url' for a public Git URL.",
        )

    if repo_url:
        try:
            repo_path = RepositorySourceService.clone_public_repository(repo_url)
            repo_name = RepositorySourceService.repository_name(repo_url)
        except RepositorySourceError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    else:
        repo_path = Path(local_path).expanduser().resolve()
        repo_name = repo_path.name

    if not repo_path.exists() or not repo_path.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Invalid repository path: {local_path}",
        )

    try:
        analysis_service = RepositoryAnalysisService(str(repo_path))
        analysis_service.graph_service = graph_service
        analysis_service.analyze()

        scanned_files = analysis_service.files
        git_info = GitService.get_git_info(repo_path)

        total_loc = sum(f.loc for f in scanned_files)
        repo_id = str(hash(str(repo_path)))

        file_dtos = [
            FileIndexDTO(
                relative_path=f.relative_path,
                extension=f.extension,
                language=f.language,
                size_bytes=f.size_bytes,
                loc=f.loc,
                sha256=f.sha256,
            )
            for f in scanned_files
        ]

        repo_dto = RepositoryDTO(
            id=repo_id,
            name=repo_name,
            path=str(repo_path),
            default_branch=git_info["branch"],
            head_commit=git_info["commit_hash"],
            head_commit_message=git_info["commit_message"],
            head_commit_author=git_info["author"],
            total_files=len(scanned_files),
            total_loc=total_loc,
            files=file_dtos,
        )

        _IN_MEMORY_REPOS[repo_id] = repo_dto
        return repo_dto
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan repository: {str(e)}")


@router.get("/{repo_id}", response_model=RepositoryDTO)
async def get_repository(repo_id: str):
    if repo_id not in _IN_MEMORY_REPOS:
        raise HTTPException(status_code=44, detail="Repository not found")
    return _IN_MEMORY_REPOS[repo_id]
