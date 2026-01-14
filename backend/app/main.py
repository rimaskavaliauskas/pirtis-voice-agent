"""
FastAPI Application - Voice Agent Backend

Main entry point for the Sauna Design Interview API.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings
from app.routers import session, admin, expert_review, skill_admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("Starting Voice Agent Backend...")
    print(f"CORS origins: {settings.cors_origins}")
    yield
    # Shutdown
    print("Shutting down Voice Agent Backend...")


# Create FastAPI application
app = FastAPI(
    title="Voice Agent API",
    description="Backend API for Sauna Design Interview Voice Agent",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(session.router, prefix="/session", tags=["Session"])
app.include_router(admin.router, prefix="/brain/config", tags=["Admin"])
app.include_router(expert_review.router, prefix="/admin", tags=["Expert Review"])
app.include_router(skill_admin.router, prefix="/admin/skill", tags=["Skill Admin"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "voice-agent-api",
        "version": "1.0.0",
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "whisper": "loaded",
    }


# ============================================
# General Translation Endpoint
# ============================================

class TranslateRequest(BaseModel):
    text: str
    target_language: str


@app.post("/translate")
async def translate_text(request: TranslateRequest):
    """Translate text to target language (for dynamic UI content)."""
    from app.services.llm import _call_llm_with_fallback
    
    lang_names = {
        'en': 'English',
        'ru': 'Russian', 
        'lt': 'Lithuanian',
    }
    lang_name = lang_names.get(request.target_language, request.target_language)
    
    # Don't translate if already in target language
    if request.target_language == 'lt':
        return {"translated_text": request.text}
    
    prompt = f"""Translate the following text from Lithuanian to {lang_name}.
Keep the same tone and meaning. Return ONLY the translated text, nothing else.

Text to translate:
{request.text}"""

    try:
        result = _call_llm_with_fallback(prompt)
        return {"translated_text": result.strip()}
    except Exception as e:
        print(f"Translation error: {e}")
        return {"translated_text": request.text}
