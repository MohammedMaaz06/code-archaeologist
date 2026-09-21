import tempfile
from pathlib import Path
from app.analyzers.python_analyzer import PythonASTAnalyzer
from app.analyzers.js_analyzer import JSTSAnalyzer


def test_python_ast_extraction():
    code = """
import os
from math import sqrt

class Calculator:
    def add(self, a, b):
        return a + b

def calculate_val(x):
    calc = Calculator()
    return sqrt(x)
"""
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w+", delete=False, encoding="utf-8") as tmp:
        tmp.write(code)
        tmp_path = Path(tmp.name)

    try:
        analyzer = PythonASTAnalyzer(tmp_path)
        symbols = analyzer.extract_symbols()

        names = [s.name for s in symbols]

        assert "os" in names
        assert "math.sqrt" in names
        assert "Calculator" in names
        assert "add" in names
        assert "calculate_val" in names

        add_symbol = next(s for s in symbols if s.name == "add")
        assert add_symbol.kind == "method"
        assert add_symbol.parent_symbol == "Calculator"
    finally:
        tmp_path.unlink()


def test_js_ts_extraction():
    code = """
import { useState } from 'react';

class UserView {
}

async function fetchUser(userId) {
    return userId;
}
"""
    with tempfile.NamedTemporaryFile(suffix=".ts", mode="w+", delete=False, encoding="utf-8") as tmp:
        tmp.write(code)
        tmp_path = Path(tmp.name)

    try:
        analyzer = JSTSAnalyzer(tmp_path)
        symbols = analyzer.extract_symbols()

        names = [s.name for s in symbols]
        assert "react" in names
        assert "UserView" in names
        assert "fetchUser" in names
    finally:
        tmp_path.unlink()
