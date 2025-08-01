#!/usr/bin/env python3
"""
Start the Python FastAPI backend server
"""
import uvicorn
import os

if __name__ == "__main__":
    # Get port from environment or default to 8001 (to avoid conflicts)
    port = int(os.getenv("PORT", 8001))
    
    # Run the FastAPI application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )