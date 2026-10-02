from app.services.llm_service import LLMService


def test_generated_python_code_validation():
    service = LLMService()

    valid = service._validate_generated_code(
        "def add(a, b):\n    return a + b",
        "python",
    )

    invalid = service._validate_generated_code(
        "def add(a, b)\n    return a + b",
        "python",
    )

    assert valid["validation_status"] == "passed"
    assert valid["validation_message"] == "Python syntax is valid."

    assert invalid["validation_status"] == "failed"
    assert "Python syntax error:" in invalid["validation_message"]
