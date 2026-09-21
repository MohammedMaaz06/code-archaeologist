import pytest
from app.services.chunker_service import CodeChunker
from app.services.vector_service import VectorSearchService


def test_syntax_aware_chunker():
    code = """def calculate_tax(amount):
    return amount * 0.2

class OrderProcessor:
    def process_order(self, order_id):
        return True
"""
    symbols = [
        {"name": "calculate_tax", "kind": "function", "start_line": 1, "end_line": 2},
        {"name": "OrderProcessor", "kind": "class", "start_line": 4, "end_line": 6},
    ]

    chunks = CodeChunker.chunk_file(
        file_path="app/billing.py",
        source_code=code,
        symbols=symbols,
        language="python"
    )

    assert len(chunks) == 2
    assert chunks[0].symbol_name == "calculate_tax"
    assert "calculate_tax" in chunks[0].content
    assert chunks[1].symbol_name == "OrderProcessor"
    assert "OrderProcessor" in chunks[1].content


def test_vector_search_engine():
    svc = VectorSearchService()
    svc.clear()

    code1 = "def authenticate_user(username, password):\n    return check_db(username)"
    code2 = "def generate_pdf_report(data):\n    return render_template(data)"

    chunks1 = CodeChunker.chunk_file("auth.py", code1, [{"name": "authenticate_user", "kind": "function", "start_line": 1, "end_line": 2}], "python")
    chunks2 = CodeChunker.chunk_file("report.py", code2, [{"name": "generate_pdf_report", "kind": "function", "start_line": 1, "end_line": 2}], "python")

    svc.index_chunks(chunks1)
    svc.index_chunks(chunks2)

    results = svc.query("authenticate user login")
    assert len(results) > 0
    assert results[0]["chunk"]["symbol_name"] == "authenticate_user"
