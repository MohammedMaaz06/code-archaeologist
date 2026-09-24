from fastapi import FastAPI
from app.api.endpoints import search

app = FastAPI(
    title="Code Archaeologist API",
    version="0.1.0",
    description="AST, Symbol Resolution, Vector Search, and Code Graph Analysis Service"
)

app.include_router(search.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "code-archaeologist-backend"}
