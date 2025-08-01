from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class User(BaseModel):
    id: str
    email: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    profileImageUrl: Optional[str] = None

class ProcessingConfig(BaseModel):
    algorithm: str = "tsne"  # tsne, umap, pca
    clustering: str = "kmeans"  # kmeans, dbscan
    clusters: int = 3
    perplexity: int = 30
    iterations: int = 1000

class Point3D(BaseModel):
    id: str
    position: List[float]  # [x, y, z]
    color: str
    cluster: int
    originalData: Dict[str, Any]

class Cluster(BaseModel):
    id: int
    color: str
    center: List[float]  # [x, y, z]
    points: List[str]  # point IDs

class ClusterAnalysis(BaseModel):
    clusterId: int
    explanation: str
    characteristics: List[str]
    dataPoints: int
    keyFeatures: List[str]

class ProcessingResult(BaseModel):
    points: List[Point3D]
    clusters: List[Cluster]
    anomalies: List[str]
    explanations: Optional[List[ClusterAnalysis]] = None

class Dataset(BaseModel):
    id: str
    name: str
    originalData: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    userId: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None