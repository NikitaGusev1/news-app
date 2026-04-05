import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

_API_SECRET = os.environ.get("API_SECRET")

from analyzer import analyze
from fetcher import fetch_all

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    urls: list[str]


@app.post("/analyze")
def analyze_endpoint(request: AnalyzeRequest, x_api_key: Optional[str] = Header(default=None)):
    if _API_SECRET and x_api_key != _API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    articles = fetch_all(request.urls)
    if len(articles) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 sources to compare, only got {len(articles)}.",
        )
    result = analyze(articles)
    return {
        "sections": result["sections"],
        "meta": {
            "sources_fetched": len(articles),
            "sources_requested": len(request.urls),
            "tokens_used": result["tokens_used"],
        },
    }
