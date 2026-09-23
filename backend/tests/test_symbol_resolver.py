import pytest
from app.services.symbol_resolver import SymbolResolver

def test_symbol_resolver_cross_file():
    resolver = SymbolResolver()

    # File 1: auth.py
    file1_analysis = {
        "file_path": "backend/auth.py",
        "imports": [],
        "classes": [],
        "functions": [
            {
                "symbol_name": "validate_user",
                "short_name": "validate_user",
                "symbol_type": "function",
                "file_path": "backend/auth.py"
            }
        ]
    }

    # File 2: payment.py
    file2_analysis = {
        "file_path": "backend/payment.py",
        "imports": [],
        "classes": [],
        "functions": [
            {
                "symbol_name": "validate_user",
                "short_name": "validate_user",
                "symbol_type": "function",
                "file_path": "backend/payment.py"
            }
        ]
    }

    # File 3: main.py
    file3_analysis = {
        "file_path": "backend/main.py",
        "imports": [
            {"module": "backend.auth", "imported_name": "validate_user", "alias": None}
        ],
        "classes": [],
        "functions": [
            {
                "symbol_name": "login",
                "short_name": "login",
                "symbol_type": "function",
                "file_path": "backend/main.py"
            }
        ]
    }

    resolver.register_symbols([file1_analysis, file2_analysis, file3_analysis])

    # 1. Test local resolution inside payment.py
    local_res = resolver.resolve_call("backend/payment.py", "process_payment", "validate_user")
    assert local_res["resolved"] is True
    assert local_res["resolution_type"] == "local"
    assert local_res["target_symbol_id"] == "backend/payment.py:validate_user"

    # 2. Test cross-file import resolution inside main.py
    import_res = resolver.resolve_call("backend/main.py", "login", "validate_user")
    assert import_res["resolved"] is True
    assert import_res["resolution_type"] == "imported"
    assert import_res["target_symbol_id"] == "backend/auth.py:validate_user"