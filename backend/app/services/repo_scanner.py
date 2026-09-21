import hashlib
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple
from app.core.logging import logger

IGNORED_DIRS: Set[str] = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    ".pytest_cache",
    ".idea",
    ".vscode",
    "coverage",
    "pgdata",
}

LANGUAGE_MAP: Dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".md": "markdown",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".html": "html",
    ".css": "css",
    ".sql": "sql",
    ".sh": "shell",
    ".ps1": "powershell",
    ".dockerfile": "dockerfile",
}


class ScannedFile:
    def __init__(
        self,
        relative_path: str,
        full_path: Path,
        extension: str,
        language: str,
        size_bytes: int,
        loc: int,
        sha256: str,
    ):
        self.relative_path = relative_path
        self.full_path = full_path
        self.extension = extension
        self.language = language
        self.size_bytes = size_bytes
        self.loc = loc
        self.sha256 = sha256


class RepoScanner:
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path).resolve()
        if not self.repo_path.exists() or not self.repo_path.is_dir():
            raise ValueError(f"Directory path does not exist or is not a directory: {repo_path}")

    def detect_language(self, file_path: Path) -> Tuple[str, str]:
        ext = file_path.suffix.lower()
        if file_path.name.lower() == "dockerfile":
            return ".dockerfile", "dockerfile"
        language = LANGUAGE_MAP.get(ext, "unknown")
        return ext, language

    @staticmethod
    def calculate_file_hash(file_path: Path) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()

    @staticmethod
    def count_loc_and_size(file_path: Path) -> Tuple[int, int]:
        size_bytes = file_path.stat().st_size
        loc = 0
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                loc = sum(1 for line in f if line.strip())
        except Exception:
            pass
        return loc, size_bytes

    def scan(self) -> List[ScannedFile]:
        scanned_files: List[ScannedFile] = []
        logger.info("Starting repository scan", path=str(self.repo_path))

        for root, dirs, files in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]

            for file_name in files:
                if file_name.startswith("."):
                    continue

                full_path = Path(root) / file_name
                relative_path = str(full_path.relative_to(self.repo_path)).replace("\\", "/")
                ext, language = self.detect_language(full_path)

                try:
                    loc, size_bytes = self.count_loc_and_size(full_path)
                    file_hash = self.calculate_file_hash(full_path)

                    scanned_files.append(
                        ScannedFile(
                            relative_path=relative_path,
                            full_path=full_path,
                            extension=ext,
                            language=language,
                            size_bytes=size_bytes,
                            loc=loc,
                            sha256=file_hash,
                        )
                    )
                except Exception as e:
                    logger.warning("Failed to scan file", file=relative_path, error=str(e))

        logger.info("Scan completed", total_files=len(scanned_files), path=str(self.repo_path))
        return scanned_files
