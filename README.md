# Code Archaeologist 🏛️🔍

> AI-Powered Codebase Intelligence & Deterministic Impact Analysis Engine

Code Archaeologist is a developer tool that analyzes legacy or unfamiliar Git repositories, extracts abstract syntax trees (AST), constructs a code knowledge graph, tracks Git historical churn, and deterministically calculates change impacts.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2
- **Database**: PostgreSQL 16 + pgvector
- **Testing**: pytest, httpx, asyncio

## Production readiness
- Copy [.env.example](.env.example) to `.env` and replace the placeholder secrets before deploying.
- In production, set `ENVIRONMENT=production`, `DEBUG=false`, and a strong `SECRET_KEY`.
- Keep `ALLOWED_ORIGINS` aligned with the domains serving the frontend.
- Set `GROQ_API_KEY` as a backend environment secret and optionally configure `GROQ_MODEL` (default: `openai/gpt-oss-120b`). Do not put the key in frontend variables or commit it to source control.
- Code explanations fall back to local Ollama if Groq is unavailable or returns an answer without valid repository citations. Configure `OLLAMA_HOST` (default: `http://localhost:11434`) and `OLLAMA_MODEL` (default: `llama3`); the model must be installed and Ollama running. With Docker Compose, set `OLLAMA_HOST` to an address reachable from the backend container, such as `http://host.docker.internal:11434` on Docker Desktop.
- Use `docker compose up --build` for the configured local stack; the compose file includes a PostgreSQL service for the backend.
