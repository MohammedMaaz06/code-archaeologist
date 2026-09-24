from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import graph

app = FastAPI(title="Code Archaeologist API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Code Archaeologist API Active"}

@app.get("/api/v1/health")
def health():
    return {"status": "ok"}

app.include_router(graph.router, prefix="/api/v1/graph", tags=["graph"])