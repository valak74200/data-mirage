"""
Main FastAPI application for Data Mirage.
Modern 3D data visualization with integrated ML processing.
"""

import logging
import asyncio
import json
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uvicorn

from core.config import settings
from core.database import init_database, close_database, check_database_connection
from core.deps import get_websocket_manager, get_current_user
from core.security_middleware import (
    SecurityHeadersMiddleware,
    InputSanitizationMiddleware,
    RequestSizeMiddleware
)
from services.websocket import WebSocketManager
from models.user import User

# Import API routers
from api import auth, users, datasets, ml

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.debug else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting Data Mirage API...")
    
    try:
        # Initialize database
        await init_database()
        logger.info("Database initialized")
        
        # Check database connection
        db_connected = await check_database_connection()
        if not db_connected:
            logger.error("Database connection failed")
            raise Exception("Database connection failed")
        
        logger.info(f"Data Mirage API started successfully on {settings.host}:{settings.port}")
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Data Mirage API...")
    
    try:
        # Close database connections
        await close_database()
        logger.info("Database connections closed")
        
        # Close WebSocket connections
        websocket_manager = app.state.websocket_manager
        if websocket_manager:
            await websocket_manager.close_all_connections()
            logger.info("WebSocket connections closed")
            
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")
    
    logger.info("Data Mirage API shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=settings.description,
    debug=settings.debug,
    lifespan=lifespan,
)

# Store WebSocket manager in app state
app.state.websocket_manager = None


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_settings.allow_origins,
    allow_credentials=settings.cors_settings.allow_credentials,
    allow_methods=settings.cors_settings.allow_methods,
    allow_headers=settings.cors_settings.allow_headers,
)

# Trusted host middleware for production
if settings.is_production:
    # Only allow specific trusted hosts in production
    trusted_hosts = [
        "data-mirage.com",
        "www.data-mirage.com",
        "api.data-mirage.com",
        "localhost",
        "127.0.0.1"
    ]
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=trusted_hosts
    )

# Security middlewares (order matters - apply from innermost to outermost)
app.add_middleware(RequestSizeMiddleware, max_size=settings.max_file_size)
app.add_middleware(InputSanitizationMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


# Exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": request.url.path,
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors."""
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "details": exc.errors(),
            "status_code": 422,
            "path": request.url.path,
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    # Always log the full error internally
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Never expose internal error details in production
    if settings.is_development:
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "status_code": 500,
                "path": request.url.path,
                "debug": {
                    "error": str(exc),
                    "type": type(exc).__name__,
                }
            }
        )
    else:
        # Production: Generic error message only
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "status_code": 500,
                "request_id": id(request),  # For support tracking
            }
        )


# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log HTTP requests."""
    start_time = asyncio.get_event_loop().time()
    
    # Process request
    response = await call_next(request)
    
    # Log request
    process_time = asyncio.get_event_loop().time() - start_time
    
    if settings.debug or request.url.path.startswith("/api"):
        logger.info(
            f"{request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s"
        )
    
    # Add process time header
    response.headers["X-Process-Time"] = str(process_time)
    
    return response


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
    }


@app.get("/health/detailed", tags=["Health"])
async def detailed_health_check():
    """Detailed health check with database status."""
    try:
        # Check database connection
        db_healthy = await check_database_connection()
        
        # Get WebSocket stats
        websocket_manager = app.state.websocket_manager
        websocket_stats = {}
        if websocket_manager:
            websocket_stats = websocket_manager.get_connection_stats()
        
        health_status = {
            "status": "healthy" if db_healthy else "unhealthy",
            "service": settings.app_name,
            "version": settings.version,
            "environment": settings.environment,
            "components": {
                "database": {
                    "status": "healthy" if db_healthy else "unhealthy",
                    "url": settings.get_masked_database_url(),
                },
                "websocket": {
                    "status": "healthy",
                    "stats": websocket_stats,
                },
                "ml_services": {
                    "status": "healthy",
                    "features": {
                        "dimensionality_reduction": ["t-SNE", "UMAP", "PCA"],
                        "clustering": ["K-Means", "DBSCAN", "HDBSCAN", "Agglomerative"],
                        "anomaly_detection": ["Isolation Forest"],
                        "ai_explanations": bool(settings.rag_settings.openai_api_key),
                    }
                }
            }
        }
        
        status_code = 200 if db_healthy else 503
        return JSONResponse(content=health_status, status_code=status_code)
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            content={
                "status": "unhealthy",
                "error": str(e),
                "service": settings.app_name,
            },
            status_code=503
        )


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
):
    """
    WebSocket endpoint for real-time communication.
    
    Handles:
    - Processing progress updates
    - Dataset upload notifications
    - Real-time ML results
    - User notifications
    """
    connection_id = None
    
    try:
        # Accept connection
        connection_id = await websocket_manager.connect(websocket)
        
        # Store websocket manager in app state if not already set
        if app.state.websocket_manager is None:
            app.state.websocket_manager = websocket_manager
        
        # Listen for messages
        while True:
            try:
                # Receive message
                data = await websocket.receive_text()
                try:
                    message_data = json.loads(data)
                    # Validate message structure
                    if not isinstance(message_data, dict):
                        raise ValueError("Message must be a JSON object")
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Invalid WebSocket message format: {e}")
                    await websocket_manager.send_to_connection(
                        connection_id,
                        {"type": "error", "message": "Invalid message format"}
                    )
                    continue
                
                # Handle message
                await websocket_manager.handle_message(connection_id, message_data)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket message error: {e}")
                await websocket_manager.send_to_connection(
                    connection_id,
                    {"type": "error", "message": "Message processing failed"}
                )
    
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    
    finally:
        # Clean up connection
        if connection_id:
            await websocket_manager.disconnect(connection_id)


# API Routes
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(ml.router, prefix="/api")


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.version,
        "description": settings.description,
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
        "websocket": "/ws",
        "api": {
            "auth": "/api/auth",
            "users": "/api/users", 
            "datasets": "/api/datasets",
            "ml": "/api/ml",
        }
    }


# Development server
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level="info" if settings.debug else "warning",
    )