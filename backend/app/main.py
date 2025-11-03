"""FastAPI application entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .models import HealthResponse

# Initialize settings
settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),  # Convert comma-separated string to list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """API health check endpoint"""
    return {
        "status": "ok",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


# TODO: Import and include routers when created
# from app.routes import documents, extractions, usage
# app.include_router(documents.router, prefix="/api", tags=["documents"])
# app.include_router(extractions.router, prefix="/api", tags=["extractions"])
# app.include_router(usage.router, prefix="/api", tags=["usage"])
