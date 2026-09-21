from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.git_service import GitService
from app.services.repo_scanner import RepoScanner

router = APIRouter()

# In-memory session database store for Phase 2 before DB migrations
_IN_MEMORY_REPOS = {}


class ScanRepoRequest(BaseModel):
    path: str = Field(..., description="Absolute path to local Git repository")


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
    repo_path = Path(request.path).resolve()
    if not repo_path.exists() or not repo_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Invalid repository path: {request.path}")

    try:
        scanner = RepoScanner(str(repo_path))
        scanned_files = scanner.scan()
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
            name=repo_path.name,
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
