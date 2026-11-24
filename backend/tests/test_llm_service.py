import pytest
import urllib.error
from pydantic import SecretStr

from app.services.llm_service import LLMService


class _LLMResponse:
    status = 200

    def __init__(self, response):
        self.response = {
            "choices": [{"message": {"content": response}}]
        }

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        import json

        return json.dumps(self.response).encode("utf-8")


class _OllamaResponse:
    status = 200

    def __init__(self, response):
        self.response = {"response": response}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        import json

        return json.dumps(self.response).encode("utf-8")


def _configure_groq(monkeypatch):
    monkeypatch.setattr(
        "app.services.llm_service.settings.GROQ_API_KEY",
        SecretStr("test-groq-key"),
    )
    monkeypatch.setattr(
        "app.services.llm_service.settings.GROQ_MODEL",
        "openai/gpt-oss-120b",
    )


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


def test_llm_service_fallback_summary(monkeypatch):
    _configure_groq(monkeypatch)
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
    
    assert explanation == (
        "I found relevant source code, but could not produce a reliable explanation "
        "for it right now. [app/auth.py:10-25]"
    )
    assert "```" not in explanation
    assert len(explanation.split()) <= 100


def test_explanation_does_not_call_llm_without_repository_evidence(monkeypatch):
    _configure_groq(monkeypatch)

    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("LLM should not be called without retrieved evidence")

    monkeypatch.setattr("urllib.request.urlopen", fail_if_called)
    digest = _context_digest()
    digest["matched_chunks"] = []

    explanation = LLMService().generate_explanation(digest)

    assert "I couldn't find relevant source code" in explanation
    assert "Code Analysis Report" not in explanation
    assert "```" not in explanation


def test_explanation_accepts_only_answers_with_citations_to_retrieved_lines(monkeypatch):
    _configure_groq(monkeypatch)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: _LLMResponse(
            "Code Archaeologist analyzes repositories. [README.md:1-3]"
        ),
    )

    explanation = LLMService().generate_explanation(_context_digest())

    assert explanation == "Code Archaeologist analyzes repositories. [README.md:1-3]"


def test_explanation_rejects_code_blocks_and_returns_plain_language_fallback(monkeypatch):
    _configure_groq(monkeypatch)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: _LLMResponse(
            "```python\ndef analyze():\n    return True\n``` [README.md:1-3]"
        ),
    )

    explanation = LLMService().generate_explanation(_context_digest())

    assert explanation.startswith("I found relevant source code")
    assert "[README.md:1-3]" in explanation
    assert "```" not in explanation


@pytest.mark.parametrize(
    "response",
    [
        "Legal Metrology is a compliance app.",
        "It analyzes repositories. [legal_metrology/server.py:1-3]",
        "It analyzes repositories. [README.md:1-4]",
    ],
)
def test_explanation_rejects_uncited_or_unavailable_sources(monkeypatch, response):
    _configure_groq(monkeypatch)
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: _LLMResponse(response),
    )

    explanation = LLMService().generate_explanation(_context_digest())

    assert "I found relevant source code" in explanation
    assert "```" not in explanation
    assert "Legal Metrology" not in explanation
    assert "legal_metrology/server.py" not in explanation


def test_explanation_prompt_requires_repository_evidence_and_citations():
    prompt = LLMService()._build_prompt(_context_digest())

    assert "using only the repository evidence below" in prompt
    assert "no more than 100 words" in prompt
    assert "Never guess or rely on prior knowledge" in prompt
    assert "say exactly what could not be determined" in prompt
    assert "Cite every repository-specific factual claim" in prompt
    assert "Never output source code, code snippets, fenced blocks" in prompt
    assert "describe what it does instead of reproducing it" in prompt
    assert "[path/to/file:START-END]" in prompt
    assert "README.md:1-3" in prompt


def test_groq_request_uses_configured_model_and_server_side_key(monkeypatch):
    _configure_groq(monkeypatch)
    requests = []

    def fake_urlopen(request, timeout):
        requests.append((request, timeout))
        return _LLMResponse(
            "Code Archaeologist analyzes repositories. [README.md:1-3]"
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    explanation = LLMService().generate_explanation(_context_digest())

    request, timeout = requests[0]
    import json

    payload = json.loads(request.data.decode("utf-8"))
    assert request.full_url == "https://api.groq.com/openai/v1/chat/completions"
    assert request.get_header("Authorization") == "Bearer test-groq-key"
    assert payload["model"] == "openai/gpt-oss-120b"
    assert payload["messages"][0]["role"] == "user"
    assert timeout == 120
    assert "[README.md:1-3]" in explanation


def test_groq_failure_uses_local_ollama(monkeypatch):
    _configure_groq(monkeypatch)
    monkeypatch.setattr(
        "app.services.llm_service.settings.OLLAMA_HOST",
        "http://localhost:11434/",
    )
    monkeypatch.setattr(
        "app.services.llm_service.settings.OLLAMA_MODEL",
        "qwen2.5",
    )
    requests = []

    def fake_urlopen(request, timeout):
        requests.append(request)
        if request.full_url.startswith("https://api.groq.com/"):
            raise urllib.error.HTTPError(
                request.full_url,
                403,
                "Forbidden",
                hdrs=None,
                fp=None,
            )
        return _OllamaResponse("The project analyzes repositories. [README.md:1-3]")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    explanation = LLMService().generate_explanation(_context_digest())

    assert explanation == "The project analyzes repositories. [README.md:1-3]"
    assert [request.full_url for request in requests] == [
        "https://api.groq.com/openai/v1/chat/completions",
        "http://localhost:11434/api/generate",
    ]
    import json

    ollama_payload = json.loads(requests[1].data.decode("utf-8"))
    assert ollama_payload["model"] == "qwen2.5"
    assert ollama_payload["stream"] is False
    assert "README.md:1-3" in ollama_payload["prompt"]


def test_missing_groq_key_uses_local_ollama(monkeypatch):
    monkeypatch.setattr("app.services.llm_service.settings.GROQ_API_KEY", None)
    requests = []

    def fake_urlopen(request, timeout):
        requests.append(request)
        return _OllamaResponse(
            "Code Archaeologist analyzes repositories. [README.md:1-3]"
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    explanation = LLMService().generate_explanation(_context_digest())

    assert explanation == "Code Archaeologist analyzes repositories. [README.md:1-3]"
    assert len(requests) == 1
    assert requests[0].full_url == "http://localhost:11434/api/generate"
