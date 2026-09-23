from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api_ast import router as ast_router
from app.api_explain import router as explain_router

app = FastAPI(title="Code Archaeologist API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ast_router)
app.include_router(explain_router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Code Archaeologist API"}
