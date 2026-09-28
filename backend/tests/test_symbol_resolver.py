from pathlib import Path
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

def test_resolves_python_import_alias():
    from app.services.symbol_resolver import SymbolResolver

    resolver = SymbolResolver()

    resolver.register_symbols([
        {
            "file_path": "auth.py",
            "imports": [],
            "classes": [],
            "functions": [
                {
                    "symbol_name": "authenticate_user",
                    "short_name": "authenticate_user",
                    "symbol_type": "function",
                    "file_path": "auth.py",
                }
            ],
        },
        {
            "file_path": "service.py",
            "imports": [
                {
                    "module": "auth",
                    "imported_name": "authenticate_user",
                    "alias": "auth_user",
                }
            ],
            "classes": [],
            "functions": [],
        },
    ])

    result = resolver.resolve_call(
        caller_file="service.py",
        caller_symbol="login_flow",
        target_name="auth_user",
    )

    assert result["resolved"] is True
    assert result["target_symbol_id"] == "auth.py:authenticate_user"


def test_resolves_javascript_relative_import_alias():
    from app.services.symbol_resolver import SymbolResolver

    resolver = SymbolResolver()

    resolver.register_symbols([
        {
            "file_path": "auth.js",
            "imports": [],
            "classes": [],
            "functions": [
                {
                    "symbol_name": "authenticateUser",
                    "short_name": "authenticateUser",
                    "symbol_type": "function",
                    "file_path": "auth.js",
                }
            ],
        },
        {
            "file_path": "service.js",
            "imports": [
                {
                    "module": "./auth.js",
                    "imported_name": "authenticateUser",
                    "alias": "authUser",
                }
            ],
            "classes": [],
            "functions": [],
        },
    ])

    result = resolver.resolve_call(
        caller_file="service.js",
        caller_symbol="loginFlow",
        target_name="authUser",
    )

    assert result["resolved"] is True
    assert result["target_symbol_id"] == "auth.js:authenticateUser"

def test_resolves_python_class_method_member_call():
    from app.services.symbol_resolver import SymbolResolver

    resolver = SymbolResolver()

    resolver.register_symbols([
        {
            "file_path": "auth.py",
            "imports": [],
            "classes": [
                {
                    "symbol_name": "UserService",
                    "short_name": "UserService",
                    "symbol_type": "class",
                    "file_path": "auth.py",
                    "methods": [
                        {
                            "symbol_name": "authenticate",
                            "short_name": "authenticate",
                            "symbol_type": "method",
                            "file_path": "auth.py",
                        }
                    ],
                }
            ],
            "functions": [],
        },
        {
            "file_path": "service.py",
            "imports": [
                {
                    "module": "auth",
                    "imported_name": "UserService",
                    "alias": "UserService",
                }
            ],
            "classes": [],
            "functions": [],
        },
    ])

    result = resolver.resolve_call(
        caller_file="service.py",
        caller_symbol="login_flow",
        target_name="authenticate",
    )

    assert result["resolved"] is True
    assert result["target_symbol_id"] == "auth.py:UserService.authenticate"


def test_resolves_javascript_class_method_import():
    from app.services.symbol_resolver import SymbolResolver

    resolver = SymbolResolver()

    resolver.register_symbols([
        {
            "file_path": "auth.js",
            "imports": [],
            "classes": [
                {
                    "symbol_name": "UserService",
                    "short_name": "UserService",
                    "symbol_type": "class",
                    "file_path": "auth.js",
                    "methods": [
                        {
                            "symbol_name": "authenticate",
                            "short_name": "authenticate",
                            "symbol_type": "method",
                            "file_path": "auth.js",
                        }
                    ],
                }
            ],
            "functions": [],
        },
        {
            "file_path": "service.js",
            "imports": [
                {
                    "module": "./auth.js",
                    "imported_name": "UserService",
                    "alias": "UserService",
                }
            ],
            "classes": [],
            "functions": [],
        },
    ])

    result = resolver.resolve_call(
        caller_file="service.js",
        caller_symbol="loginFlow",
        target_name="authenticate",
    )

    assert result["resolved"] is True
    assert result["target_symbol_id"] == "auth.js:UserService.authenticate"


def test_resolves_python_instance_method_from_constructor_binding():
    resolver = SymbolResolver()

    resolver.register_symbols([
        {
            "file_path": "auth.py",
            "imports": [],
            "classes": [
                {
                    "symbol_name": "UserService",
                    "short_name": "UserService",
                    "symbol_type": "class",
                    "file_path": "auth.py",
                    "methods": [
                        {
                            "symbol_name": "authenticate",
                            "short_name": "authenticate",
                            "symbol_type": "method",
                            "file_path": "auth.py",
                        }
                    ],
                }
            ],
            "functions": [],
        },
        {
            "file_path": "service.py",
            "imports": [
                {
                    "module": "auth",
                    "imported_name": "UserService",
                    "alias": "UserService",
                }
            ],
            "variable_bindings": [
                {
                    "variable_name": "service",
                    "class_name": "UserService",
                }
            ],
            "classes": [],
            "functions": [],
        },
    ])

    result = resolver.resolve_call(
        caller_file="service.py",
        caller_symbol="login_flow",
        target_name="authenticate",
        receiver_name="service",
    )

    assert result["resolved"] is True
    assert result["resolution_type"] == "instance_member"
    assert result["target_symbol_id"] == "auth.py:UserService.authenticate"


def test_resolves_javascript_instance_method_from_constructor_binding():
    resolver = SymbolResolver()

    resolver.register_symbols([
        {
            "file_path": "auth.js",
            "imports": [],
            "classes": [
                {
                    "symbol_name": "UserService",
                    "short_name": "UserService",
                    "symbol_type": "class",
                    "file_path": "auth.js",
                    "methods": [
                        {
                            "symbol_name": "authenticate",
                            "short_name": "authenticate",
                            "symbol_type": "method",
                            "file_path": "auth.js",
                        }
                    ],
                }
            ],
            "functions": [],
        },
        {
            "file_path": "service.js",
            "imports": [
                {
                    "module": "./auth.js",
                    "imported_name": "UserService",
                    "alias": "UserService",
                }
            ],
            "variable_bindings": [
                {
                    "variable_name": "service",
                    "class_name": "UserService",
                }
            ],
            "classes": [],
            "functions": [],
        },
    ])

    result = resolver.resolve_call(
        caller_file="service.js",
        caller_symbol="loginFlow",
        target_name="authenticate",
        receiver_name="service",
    )

    assert result["resolved"] is True
    assert result["resolution_type"] == "instance_member"
    assert result["target_symbol_id"] == "auth.js:UserService.authenticate"


def test_python_nested_member_call_chain_is_extracted():
    from backend.app.analyzers.python_analyzer import PythonASTAnalyzer

    source = """
class App:
    def run(self):
        self.auth_service.authenticate()
"""

    analyzer = PythonASTAnalyzer(Path("service.py"), source)
    result = analyzer.analyze()

    calls = [
        call
        for call in result["calls"]
        if call.get("target_name") == "authenticate"
    ]

    assert len(calls) == 1
    assert calls[0]["receiver_name"] == "self"
    assert calls[0]["receiver_chain"] == ["self", "auth_service"]


def test_python_multi_level_member_call_chain_is_extracted():
    from backend.app.analyzers.python_analyzer import PythonASTAnalyzer

    source = """
class App:
    def run(self):
        self.services.auth.authenticate()
"""

    analyzer = PythonASTAnalyzer(Path("service.py"), source)
    result = analyzer.analyze()

    calls = [
        call
        for call in result["calls"]
        if call.get("target_name") == "authenticate"
    ]

    assert len(calls) == 1
    assert calls[0]["receiver_chain"] == [
        "self",
        "services",
        "auth",
    ]


def test_javascript_nested_member_call_chain_is_extracted():
    from backend.app.analyzers.js_analyzer import JSTSAnalyzer

    source = """
class App {
    run() {
        this.authService.authenticate();
    }
}
"""

    analyzer = JSTSAnalyzer(Path("service.js"), source)
    result = analyzer.analyze()

    calls = [
        call
        for call in result["calls"]
        if call.get("target_name") == "authenticate"
    ]

    assert len(calls) == 1
    assert calls[0]["receiver_name"] == "this"
    assert calls[0]["receiver_chain"] == [
        "this",
        "authService",
    ]


def test_javascript_multi_level_member_call_chain_is_extracted():
    from backend.app.analyzers.js_analyzer import JSTSAnalyzer

    source = """
class App {
    run() {
        this.services.auth.authenticate();
    }
}
"""

    analyzer = JSTSAnalyzer(Path("service.js"), source)
    result = analyzer.analyze()

    calls = [
        call
        for call in result["calls"]
        if call.get("target_name") == "authenticate"
    ]

    assert len(calls) == 1
    assert calls[0]["receiver_chain"] == [
        "this",
        "services",
        "auth",
    ]
