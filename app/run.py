#!/usr/bin/env python3
"""
Script to run the Data Mirage FastAPI application.
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path

# Add app directory to Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

import uvicorn
from core.config import settings


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Run Data Mirage FastAPI server")
    parser.add_argument(
        "--host",
        default=settings.host,
        help=f"Host to bind to (default: {settings.host})"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=settings.port,
        help=f"Port to bind to (default: {settings.port})"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=settings.reload,
        help="Enable auto-reload for development"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)"
    )
    parser.add_argument(
        "--log-level",
        default="info",
        choices=["critical", "error", "warning", "info", "debug", "trace"],
        help="Log level (default: info)"
    )
    
    args = parser.parse_args()
    
    # Print startup information
    print(f"🚀 Starting {settings.app_name} v{settings.version}")
    print(f"📊 Environment: {settings.environment}")
    print(f"🌐 Server: http://{args.host}:{args.port}")
    print(f"📚 API Docs: http://{args.host}:{args.port}/docs")
    print(f"🔧 Interactive Docs: http://{args.host}:{args.port}/redoc")
    print(f"💬 WebSocket: ws://{args.host}:{args.port}/ws")
    print("-" * 50)
    
    # Run server
    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
        log_level=args.log_level,
        access_log=settings.debug,
        app_dir=str(app_dir),
    )


if __name__ == "__main__":
    main()