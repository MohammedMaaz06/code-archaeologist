import hashlib
import os
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

from app.core.logging import logger


class RepositorySourceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class RepositorySourceService:
    """Resolve a local repository path or clone a supported public Git HTTPS URL."""

    ALLOWED_HOSTS = {"github.com", "gitlab.com", "bitbucket.org"}
    CLONE_TIMEOUT_SECONDS = 120
    FETCH_TIMEOUT_SECONDS = 30

    @classmethod
    def _parse_url(cls, repo_url: str) -> tuple[str, str]:
        value = repo_url.strip()
        if not value or len(value) > 2048:
            raise RepositorySourceError("Enter a valid public Git repository URL.")

        try:
            parsed = urlsplit(value)
            port = parsed.port
        except ValueError as exc:
            raise RepositorySourceError("The repository URL is malformed.") from exc

        if parsed.scheme.lower() != "https" or not parsed.hostname:
            raise RepositorySourceError(
                "Only public HTTPS Git URLs are supported, such as "
                "https://github.com/owner/repository."
            )

        if parsed.username is not None or parsed.password is not None:
            raise RepositorySourceError(
                "Do not include usernames, passwords, or access tokens in the URL."
            )

        host = parsed.hostname.lower().rstrip(".")
        if host not in cls.ALLOWED_HOSTS:
            raise RepositorySourceError(
                "Supported Git hosts are github.com, gitlab.com, and bitbucket.org."
            )

        if port not in (None, 443) or parsed.query or parsed.fragment:
            raise RepositorySourceError(
                "Custom ports, query strings, and URL fragments are not supported."
            )

        path = parsed.path
        # GitLab repository pages may include /-/tree/<branch> after the project path.
        if host == "gitlab.com":
            path = path.split("/-/", 1)[0]

        parts = [part for part in path.strip("/").split("/") if part]
        if len(parts) < 2 or (host != "gitlab.com" and len(parts) != 2):
            raise RepositorySourceError(
                "Enter the repository's root URL, not a branch, file, or directory URL."
            )

        if any(
            part in {".", ".."}
            or "/" in part
            or "\\" in part
            or part.lower() in {"%2f", "%5c"}
            for part in parts
        ):
            raise RepositorySourceError("The repository URL contains an invalid path.")

        repo_component = parts[-1]
        if repo_component.endswith(".git"):
            repo_component = repo_component[:-4]

        name = re.sub(r"[^A-Za-z0-9._-]+", "-", repo_component).strip(".-")
        if not name:
            raise RepositorySourceError("Could not determine the repository name.")

        normalized_url = f"https://{host}/{'/'.join(parts)}"
        return normalized_url, name

    @classmethod
    def repository_name(cls, repo_url: str) -> str:
        return cls._parse_url(repo_url)[1]

    @staticmethod
    def _git_environment() -> dict[str, str]:
        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"
        env["GIT_CONFIG_NOSYSTEM"] = "1"
        # The feature supports public HTTPS repositories and must not use local
        # user-level URL rewrites or credential helpers.
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        return env

    @classmethod
    def _run_git(cls, args: list[str], timeout: int) -> subprocess.CompletedProcess:
        return subprocess.run(
            [
                "git",
                "-c", "protocol.file.allow=never",
                "-c", "protocol.ext.allow=never",
                *args,
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=cls._git_environment(),
            check=False,
        )

    @classmethod
    def clone_public_repository(cls, repo_url: str) -> Path:
        normalized_url, repo_name = cls._parse_url(repo_url)
        cache_root = Path(
            os.environ.get(
                "CODE_ARCHAEOLOGIST_REPOSITORY_CACHE",
                str(Path.home() / ".code-archaeologist" / "repositories"),
            )
        ).expanduser().resolve()
        cache_root.mkdir(parents=True, exist_ok=True)

        digest = hashlib.sha256(normalized_url.encode("utf-8")).hexdigest()[:12]
        destination = cache_root / f"{repo_name}-{digest}"
        existed_before = destination.exists()

        if destination.is_symlink():
            raise RepositorySourceError("The managed repository cache entry is unsafe.", 409)

        try:
            if existed_before:
                if not destination.is_dir() or not (destination / ".git").exists():
                    raise RepositorySourceError(
                        "The cached repository directory is invalid. Remove that cache entry and retry.",
                        409,
                    )

                remote = cls._run_git(
                    ["-C", str(destination), "remote", "get-url", "origin"],
                    timeout=10,
                )
                if remote.returncode != 0 or remote.stdout.strip() != normalized_url:
                    raise RepositorySourceError(
                        "The cached repository's origin does not match this URL.",
                        409,
                    )

                fetch = cls._run_git(
                    ["-C", str(destination), "fetch", "--depth", "1", "origin"],
                    timeout=cls.FETCH_TIMEOUT_SECONDS,
                )
                if fetch.returncode != 0:
                    raise RepositorySourceError(
                        "Could not refresh the cached repository. Check the URL and network connection.",
                        502,
                    )

                reset = cls._run_git(
                    ["-C", str(destination), "reset", "--hard", "FETCH_HEAD"],
                    timeout=15,
                )
                if reset.returncode != 0:
                    raise RepositorySourceError("Could not update the cached repository.", 502)
            else:
                clone = cls._run_git(
                    [
                        "clone",
                        "--depth", "1",
                        "--no-recurse-submodules",
                        normalized_url,
                        str(destination),
                    ],
                    timeout=cls.CLONE_TIMEOUT_SECONDS,
                )
                if clone.returncode != 0:
                    shutil.rmtree(destination, ignore_errors=True)
                    reason = (clone.stderr or "Git returned an unknown error").strip()
                    logger.warning(
                        "Public Git clone failed",
                        host=urlsplit(normalized_url).hostname,
                        error=reason[-400:],
                    )
                    raise RepositorySourceError(
                        f"Git clone failed: {reason[-400:]}",
                        502,
                    )

                if not (destination / ".git").exists():
                    shutil.rmtree(destination, ignore_errors=True)
                    raise RepositorySourceError(
                        "Git clone finished without producing a valid repository.",
                        502,
                    )

        except subprocess.TimeoutExpired as exc:
            if not existed_before:
                shutil.rmtree(destination, ignore_errors=True)
            raise RepositorySourceError(
                "The Git operation timed out. Try again or use a smaller repository.",
                504,
            ) from exc

        return destination.resolve()
