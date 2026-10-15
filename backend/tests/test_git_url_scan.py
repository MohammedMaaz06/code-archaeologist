import subprocess
from pathlib import Path

import pytest

from app.services.repository_source_service import (
    RepositorySourceError,
    RepositorySourceService,
)


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/example/demo",
        "ssh://git@github.com/example/demo.git",
        "https://example.com/example/demo.git",
        "https://user:secret@github.com/example/demo.git",
        "https://github.com/example",
        "https://github.com/example/demo?token=secret",
    ],
)
def test_public_git_url_validation_rejects_unsupported_urls(url, tmp_path, monkeypatch):
    monkeypatch.setenv("CODE_ARCHAEOLOGIST_REPOSITORY_CACHE", str(tmp_path / "cache"))

    with pytest.raises(RepositorySourceError):
        RepositorySourceService.clone_public_repository(url)


def test_public_git_clone_uses_shallow_clone_without_submodules(tmp_path, monkeypatch):
    cache = tmp_path / "cache"
    monkeypatch.setenv("CODE_ARCHAEOLOGIST_REPOSITORY_CACHE", str(cache))
    commands = []

    def fake_run(args, **kwargs):
        commands.append(args)
        destination = Path(args[-1])
        destination.mkdir(parents=True)
        (destination / ".git").mkdir()
        return subprocess.CompletedProcess(args, 0, "", "")

    monkeypatch.setattr(
        "app.services.repository_source_service.subprocess.run",
        fake_run,
    )

    result = RepositorySourceService.clone_public_repository(
        "https://github.com/example/demo.git"
    )

    assert result.is_dir()
    assert (result / ".git").is_dir()
    assert result.parent == cache.resolve()
    assert result.name.startswith("demo-")
    assert "--depth" in commands[0]
    assert "1" in commands[0]
    assert "--no-recurse-submodules" in commands[0]


@pytest.mark.asyncio
async def test_scan_endpoint_accepts_public_git_url(async_client, tmp_path, monkeypatch):
    from app.services.repository_source_service import RepositorySourceService

    (tmp_path / "main.py").write_text(
        "def greet():\n    return 'hello'\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(
        RepositorySourceService,
        "clone_public_repository",
        staticmethod(lambda _url: tmp_path),
    )

    response = await async_client.post(
        "/api/v1/scan",
        json={"repo_url": "https://github.com/example/demo"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "demo"
    assert data["total_files"] == 1
    assert data["path"] == str(tmp_path.resolve())


@pytest.mark.asyncio
async def test_scan_endpoint_rejects_unsupported_git_host(async_client):
    response = await async_client.post(
        "/api/v1/scan",
        json={"repo_url": "https://example.com/example/demo.git"},
    )

    assert response.status_code == 400
    assert "Supported Git hosts" in response.json()["detail"]


@pytest.mark.asyncio
async def test_scan_endpoint_requires_exactly_one_source(async_client, tmp_path):
    response_empty = await async_client.post("/api/v1/scan", json={})
    assert response_empty.status_code == 400

    response_both = await async_client.post(
        "/api/v1/scan",
        json={
            "path": str(tmp_path),
            "repo_url": "https://github.com/example/demo",
        },
    )
    assert response_both.status_code == 400
