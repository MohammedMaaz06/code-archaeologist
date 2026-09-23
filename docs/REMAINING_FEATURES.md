# Code Archaeologist - Remaining Features Matrix

| Feature | Current Status | What Exists | What's Missing | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **0. Git Clean & Untrack** | Pending | Basic repo files | `.gitignore` rules for `.venv`, `node_modules`, `__pycache__` | P0 |
| **1. Complete Static Analysis** | Partial | Basic AST parsing & regex | Full AST extraction (returns, calls, decorators, Tree-sitter for TS/JS) | P0 |
| **2. Symbol Resolution** | Partial | Basic string-matching calls | Scope-aware symbol tables, import resolution, cross-file cross-module linking | P0 |
| **3. Knowledge Graph** | Partial | Basic NetworkX graph | Expanded schema (Nodes: Class, API, DB, Test; Edges: CALLS, INHERITS, EXPOSES) | P1 |
| **4. Analysis Persistence** | Missing | In-memory NetworkX model | PostgreSQL / SQLAlchemy models for persistent indexing & repeatable scans | P1 |
| **5. Semantic Code Search** | Partial | Basic TF-IDF / keyword search | `sentence-transformers` vector embeddings, vector store / pgvector, retrieval metrics | P1 |
| **6. Git Intelligence** | Basic | Basic git log wrapper | Churn, file author history, commit parsing, conservative bug-fix heuristics | P2 |
| **7. Function Git History** | Missing | None | Function-level line range history and modification tracking | P2 |
| **8. Flagship Impact Analysis**| Basic | Basic string call lookup | Multidepth change impact traversal (Callers, APIs, DB, Tests) with line-level evidence | P0 |
| **9. Impact Evidence** | Missing | None | Explanatory evidence paths (file, lines, reason) for every impact item | P1 |
| **10. API Impact Detection** | Missing | None | FastAPI/Flask/Express route decorator analysis linked to graph functions | P1 |
| **11. DB Impact Detection** | Missing | None | SQL/SQLAlchemy/ORM pattern detection (READ, WRITE, INSERT, UPDATE, DELETE) | P2 |
| **12. Test Impact Analysis** | Missing | None | Associating tests with covered functions/classes and `/impact/tests` endpoint | P2 |
| **13. Architecture View** | Missing | Basic UI cards | Dynamic architecture reconstruction (Frontend -> API -> Service -> Repo -> DB) | P2 |
| **14. Git-Aware Risk ML** | Basic | Simple heuristic calculation | Feature extraction (complexity, churn, deps) + Scikit-Learn bug-risk classifier | P2 |
| **15. LLM Evidence Pipeline**| Partial | Simple prompt completion | Grounded multi-source RAG pipeline (Graph + Git + Vector + Code Evidence) | P1 |
| **16. Frontend UI Upgrade** | Basic | 2D/3D components present | Unified multi-tab dashboard (Impact Analyzer, Risk, Architecture, Search) | P2 |
| **17. Evaluation Framework**| Missing | None | Benchmark repositories, accuracy scripts (MRR, Recall@K, Precision@K) | P3 |