from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .routes import chat, license, profile, challenges

app = FastAPI(
    title="VibeStream API",
    version="0.1.0",
    description="Backend for VibeStream — Gemini proxy, license validation, profile sync",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(license.router)
app.include_router(profile.router)
app.include_router(challenges.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vibestream"}
