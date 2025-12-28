"""
FastAPI Application - Voice Agent Backend

Main entry point for the Sauna Design Interview API.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import session, admin

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
