#!/usr/bin/env python3
"""
Direct server startup script for debugging
"""
import sys
import os

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

print(f"Starting from directory: {current_dir}")
print(f"Python path: {sys.path}")

try:
    import uvicorn
    print("✓ uvicorn imported")
    
    import fastapi
    print("✓ fastapi imported")
    
    from main import app
    print("✓ main app imported")
    
    print("Starting server on 0.0.0.0:8001...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info",
        reload=False
    )
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()