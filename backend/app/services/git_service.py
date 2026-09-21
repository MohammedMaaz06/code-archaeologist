import subprocess
from pathlib import Path
from typing import Dict, Optional
from app.core.logging import logger


class GitService:
    @staticmethod
    def is_git_repository(repo_path: Path) -> bool:
        git_dir = repo_path / ".git"
        return git_dir.exists() and git_dir.is_dir()

    @staticmethod
    def get_git_info(repo_path: Path) -> Dict[str, Optional[str]]:
        if not GitService.is_git_repository(repo_path):
            return {
                "branch": None,
                "commit_hash": None,
                "commit_message": None,
                "author": None,
            }

        try:
            branch = subprocess.check_output(
                ["git", "-C", str(repo_path), "rev-parse", "--abbrev-ref", "HEAD"],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()

            commit_hash = subprocess.check_output(
                ["git", "-C", str(repo_path), "rev-parse", "HEAD"],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()

            commit_message = subprocess.check_output(
                ["git", "-C", str(repo_path), "log", "-1", "--pretty=format:%s"],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()

            author = subprocess.check_output(
                ["git", "-C", str(repo_path), "log", "-1", "--pretty=format:%an <%ae>"],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()

            return {
                "branch": branch,
                "commit_hash": commit_hash,
                "commit_message": commit_message,
                "author": author,
            }
        except Exception as e:
            logger.warning("Failed to extract Git metadata", path=str(repo_path), error=str(e))
            return {
                "branch": None,
                "commit_hash": None,
                "commit_message": None,
                "author": None,
            }
