import pytest
from app.services.llm_service import LLMService


class _LLMResponse:
    status = 200

    def __init__(self, response):
        self.response = response

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        import json

        return json.dumps({"response": self.response}).encode("utf-8")


def _context_digest():
    return {
        "query": "What does this project do?",
        "relevant_files": ["README.md"],
        "matched_chunks": [
            {
                "file_path": "README.md",
                "symbol_name": None,
                "lines": "1-3",
                "content": "# Code Archaeologist\nA codebase analysis tool.",
            }
        ],
        "dependency_context": {},
    }


def test_llm_service_fallback_summary():
    svc = LLMService(api_url="http://invalid-localhost-url:9999/generate")
    
    context_digest = {
        "query": "authentication pipeline",
        "relevant_files": ["app/auth.py"],
        "matched_chunks": [
            {
                "file_path": "app/auth.py",
                "symbol_name": "login_user",
                "lines": "10-25",
                "content": "def login_user(): pass"
            }
        ],
        "dependency_context": {}
    }

    explanation = svc.generate_explanation(context_digest)
    
    assert "Code Analysis Report for 'authentication pipeline'" in explanation
    assert "login_user" in explanation
    assert "app/auth.py" in explanation


def test_explanation_does_not_call_llm_without_repository_evidence(monkeypatch):
    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("LLM should not be called without retrieved evidence")

    monkeypatch.setattr("urllib.request.urlopen", fail_if_called)
    digest = _context_digest()
    digest["matched_chunks"] = []

    explanation = LLMService().generate_explanation(digest)

    assert "No relevant source snippets were retrieved" in explanation


def test_explanation_accepts_only_answers_with_citations_to_retrieved_lines(monkeypatch):
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: _LLMResponse(
            "Code Archaeologist analyzes repositories. [README.md:1-3]"
        ),
    )

    explanation = LLMService().generate_explanation(_context_digest())

    assert explanation == "Code Archaeologist analyzes repositories. [README.md:1-3]"


@pytest.mark.parametrize(
    "response",
    [
        "Legal Metrology is a compliance app.",
        "It analyzes repositories. [legal_metrology/server.py:1-3]",
        "It analyzes repositories. [README.md:1-4]",
    ],
)
def test_explanation_rejects_uncited_or_unavailable_sources(monkeypatch, response):
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: _LLMResponse(response),
    )

    explanation = LLMService().generate_explanation(_context_digest())

    assert "Code Analysis Report for 'What does this project do?'" in explanation
    assert "Legal Metrology" not in explanation
    assert "legal_metrology/server.py" not in explanation


def test_explanation_prompt_requires_repository_evidence_and_citations():
    prompt = LLMService()._build_prompt(_context_digest())

    assert "using only the repository evidence below" in prompt
    assert "Do not rely on prior knowledge" in prompt
    assert "[path/to/file:START-END]" in prompt
    assert "README.md:1-3" in prompt
