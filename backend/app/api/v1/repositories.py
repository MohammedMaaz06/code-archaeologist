from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.git_service import GitService
from app.services.repository_analysis_service import RepositoryAnalysisService
from app.services.repository_state import register_graph_service
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


# Only send text source/documentation files to the browser for indexing. Limits keep
# a scan response from ballooning when a repository contains generated or large files.
INDEXABLE_SOURCE_EXTENSIONS = {
    ".py", ".pyi", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
    ".go", ".rs", ".java", ".c", ".h", ".cc", ".cpp", ".hpp", ".cs",
    ".rb", ".php", ".swift", ".kt", ".kts", ".scala", ".sql", ".sh",
    ".ps1", ".vue", ".svelte", ".html", ".css", ".scss", ".md",
    ".json", ".yaml", ".yml", ".toml", ".xml",
}
MAX_INDEXABLE_FILE_BYTES = 512 * 1024
MAX_INDEXABLE_RESPONSE_BYTES = 8 * 1024 * 1024


def _read_indexable_source(
    repo_path: Path,
    relative_path: str,
    size_bytes: int,
    remaining_budget: int,
) -> Optional[str]:
    """Read a bounded text file only if it stays inside the scanned repository."""
    if remaining_budget <= 0 or size_bytes > MAX_INDEXABLE_FILE_BYTES:
        return None

    relative = Path(relative_path)
    if relative.suffix.lower() not in INDEXABLE_SOURCE_EXTENSIONS:
        return None

    try:
        resolved_repo = repo_path.resolve()
        candidate = (resolved_repo / relative).resolve()
        candidate.relative_to(resolved_repo)
        if not candidate.is_file() or candidate.stat().st_size > MAX_INDEXABLE_FILE_BYTES:
            return None

        source = candidate.read_text(encoding="utf-8", errors="ignore")
        if len(source.encode("utf-8")) > remaining_budget:
            return None
        return source
    except (OSError, ValueError):
        return None


class FileIndexDTO(BaseModel):
    relative_path: str
    extension: str
    language: str
    size_bytes: int
    loc: int
    sha256: str
    source_code: Optional[str] = None


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
        analysis_service.analyze()
        register_graph_service(str(repo_path), analysis_service.graph_service)
        graph_service.graph = analysis_service.graph_service.graph

        scanned_files = analysis_service.files
        git_info = GitService.get_git_info(repo_path)

        total_loc = sum(f.loc for f in scanned_files)
        repo_id = str(hash(str(repo_path)))

        file_dtos = []
        remaining_content_budget = MAX_INDEXABLE_RESPONSE_BYTES
        for f in scanned_files:
            source_code = _read_indexable_source(
                repo_path,
                f.relative_path,
                f.size_bytes,
                remaining_content_budget,
            )
            if source_code is not None:
                remaining_content_budget -= len(source_code.encode("utf-8"))

            file_dtos.append(
                FileIndexDTO(
                    relative_path=f.relative_path,
                    extension=f.extension,
                    language=f.language,
                    size_bytes=f.size_bytes,
                    loc=f.loc,
                    sha256=f.sha256,
                    source_code=source_code,
                )
            )

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
