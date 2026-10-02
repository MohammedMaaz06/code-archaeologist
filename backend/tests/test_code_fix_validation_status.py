from unittest.mock import patch

from app.services.llm_service import LLMService


def test_code_fix_returns_success_for_valid_python():
    service = LLMService()

    with patch(
        "app.services.llm_service.urllib.request.urlopen"
    ) as mock_urlopen:
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = (
            b'{"response":"def add(a, b):\\n    return a + b"}'
        )

        result = service.generate_code_fix(
            source_code="def add(a, b):\n    return a - b",
            issue="Return the sum.",
            language="python",
        )

    assert result["status"] == "success"
    assert result["validation_status"] == "passed"


def test_code_fix_returns_validation_failed_for_invalid_python():
    service = LLMService()

    with patch(
        "app.services.llm_service.urllib.request.urlopen"
    ) as mock_urlopen:
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = (
            b'{"response":"def add(a, b)\\n    return a + b"}'
        )

        result = service.generate_code_fix(
            source_code="def add(a, b):\n    return a - b",
            issue="Return the sum.",
            language="python",
        )

    assert result["status"] == "validation_failed"
    assert result["validation_status"] == "failed"
    assert result["corrected_code"] is not None
    assert result["diff"]
    assert "expected ':'" in result["validation_message"]
