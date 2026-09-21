import tempfile
from pathlib import Path
from app.services.repo_scanner import RepoScanner


def test_repo_scanner_basic():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        py_file = tmp_path / "main.py"
        py_file.write_text("print('hello world')\n", encoding="utf-8")

        ignored_dir = tmp_path / "node_modules"
        ignored_dir.mkdir()
        ignored_file = ignored_dir / "index.js"
        ignored_file.write_text("console.log('ignore me');\n", encoding="utf-8")

        scanner = RepoScanner(tmpdir)
        scanned = scanner.scan()

        assert len(scanned) == 1
        assert scanned[0].relative_path == "main.py"
        assert scanned[0].language == "python"
        assert scanned[0].loc == 1
        assert len(scanned[0].sha256) == 64
