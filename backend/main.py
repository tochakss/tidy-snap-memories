"""
TidySnaps FastAPI backend entry point.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import scan, duplicates, score, publish, files, albums

app = FastAPI(
    title="TidySnaps API",
    description="AI-powered photo and video cleanup backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router, prefix="/api", tags=["scan"])
app.include_router(duplicates.router, prefix="/api", tags=["duplicates"])
app.include_router(score.router, prefix="/api", tags=["score"])
app.include_router(publish.router, prefix="/api", tags=["publish"])
app.include_router(files.router, prefix="/api", tags=["files"])
app.include_router(albums.router, prefix="/api", tags=["albums"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "1.0"}
