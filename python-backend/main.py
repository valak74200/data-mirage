from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import pandas as pd
import numpy as np
import json
import os
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime
import uuid

# Import will be fixed after package installation

app = FastAPI(title="Data Mirage API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services - will be initialized after fixing imports
security = HTTPBearer()

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()

# Simplified auth for now - will be properly implemented after package setup
async def get_current_user():
    # Mock user for development
    class MockUser:
        def __init__(self):
            self.id = "45538481"
            self.email = "user@example.com"
    return MockUser()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            print(f"WebSocket message: {message}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# In-memory storage for development
datasets_store = {}

@app.post("/api/datasets")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        # Read file content
        content = await file.read()
        
        # Parse data based on file type
        if file.filename.endswith('.csv'):
            import io
            df = pd.read_csv(io.StringIO(content.decode('utf-8')))
            data = df.to_dict('records')
        elif file.filename.endswith('.json'):
            data = json.loads(content.decode('utf-8'))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Create dataset metadata
        metadata = {
            "fileName": file.filename,
            "fileSize": len(content),
            "rowCount": len(data),
            "columnCount": len(data[0].keys()) if data else 0,
            "columns": list(data[0].keys()) if data else [],
            "uploadedAt": datetime.now().isoformat()
        }
        
        # Save to in-memory store
        dataset_id = str(uuid.uuid4())
        dataset = {
            "id": dataset_id,
            "name": file.filename,
            "metadata": metadata,
            "originalData": data
        }
        datasets_store[dataset_id] = dataset
        
        return dataset
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")

@app.get("/api/datasets")
async def get_datasets():
    return list(datasets_store.values())

@app.post("/api/process/{dataset_id}")
async def process_dataset(dataset_id: str, config: dict):
    try:
        # Get dataset from in-memory store
        dataset = datasets_store.get(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Broadcast processing start
        await manager.broadcast({
            "type": "processing_started",
            "datasetId": dataset_id,
            "config": config
        })
        
        # Import ML processor here
        import sys
        import os
        sys.path.append(os.path.dirname(__file__))
        from services.ml_processor import MLProcessor
        ml_processor = MLProcessor()
        
        # Process with ML
        result = await ml_processor.process_dataset(dataset['originalData'], config)
        
        # Generate RAG explanations
        try:
            from services.rag_service import RAGService
            rag_service = RAGService()
            explanations = await rag_service.explain_clusters(result, dataset['metadata'])
            result.explanations = explanations
            
            await manager.broadcast({
                "type": "rag_completed",
                "datasetId": dataset_id,
                "explanations": [exp.dict() for exp in explanations]
            })
        except Exception as e:
            print(f"RAG error: {e}")
            # Provide fallback explanations
            result.explanations = [
                {
                    "clusterId": cluster.id,
                    "explanation": f"Cluster {cluster.id} contient {len(cluster.points)} points avec des caractéristiques similaires.",
                    "characteristics": ["Données groupées par similarité"],
                    "dataPoints": len(cluster.points),
                    "keyFeatures": ["Patron identifié"]
                }
                for cluster in result.clusters
            ]
        
        # Convert result to dict for JSON serialization
        result_dict = result.dict() if hasattr(result, 'dict') else result.__dict__
        
        # Broadcast completion
        await manager.broadcast({
            "type": "processing_completed",
            "datasetId": dataset_id,
            "result": result_dict
        })
        
        return result_dict
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)