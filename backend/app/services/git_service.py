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
    def get_file_history(
        repo_path: Path,
        file_path: str,
        limit: int = 5,
    ) -> list[Dict[str, str]]:
        if limit <= 0 or not GitService.is_git_repository(repo_path):
            return []

        try:
            target = Path(file_path).as_posix()

            output = subprocess.check_output(
                [
                    "git",
                    "-C",
                    str(repo_path),
                    "log",
                    f"-{limit}",
                    "--date=iso-strict",
                    "--format=%H%x09%ad%x09%an%x09%s",
                    "--",
                    target,
                ],
                stderr=subprocess.DEVNULL,
                text=True,
            )

            history = []
            for line in output.splitlines():
                parts = line.split("\t", 3)
                if len(parts) != 4:
                    continue

                commit_hash, committed_at, author, message = parts

                history.append(
                    {
                        "commit_hash": commit_hash,
                        "committed_at": committed_at,
                        "author": author,
                        "message": message,
                    }
                )

            return history
        except Exception as e:
            logger.warning(
                "Failed to extract Git file history",
                path=str(repo_path),
                file=file_path,
                error=str(e),
            )
            return []

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
