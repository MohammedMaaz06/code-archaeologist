import pytest
from app.services.llm_service import LLMService


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
