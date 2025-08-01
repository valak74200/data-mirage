import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans, DBSCAN
from sklearn.ensemble import IsolationForest
from typing import List, Dict, Any, Optional
import json
from pydantic import BaseModel

# Define schemas locally to avoid import issues
class ProcessingConfig(BaseModel):
    algorithm: str = "tsne"
    clustering: str = "kmeans" 
    clusters: int = 3
    perplexity: int = 30
    iterations: int = 1000

class Point3D(BaseModel):
    id: str
    position: List[float]
    color: str
    cluster: int
    originalData: Dict[str, Any]

class Cluster(BaseModel):
    id: int
    color: str
    center: List[float]
    points: List[str]

class ProcessingResult(BaseModel):
    points: List[Point3D]
    clusters: List[Cluster]
    anomalies: List[str]

class MLProcessor:
    def __init__(self):
        self.scaler = StandardScaler()
        
    async def process_dataset(self, data: List[Dict], config: dict) -> ProcessingResult:
        """Process dataset with proper ML algorithms using scikit-learn"""
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Select numeric columns only
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(numeric_columns) < 2:
            raise ValueError("Dataset needs at least 2 numeric columns for analysis")
        
        # Prepare data
        X = df[numeric_columns].fillna(0)  # Handle missing values
        X_scaled = self.scaler.fit_transform(X)
        
        # Dimensionality reduction
        algorithm = config.get('algorithm', 'tsne')
        if algorithm == "tsne":
            # Use PCA first if high dimensional, then t-SNE
            if X_scaled.shape[1] > 50:
                pca = PCA(n_components=50)
                X_reduced = pca.fit_transform(X_scaled)
            else:
                X_reduced = X_scaled
                
            perplexity = min(config.get('perplexity', 30), len(X_reduced) - 1)
            tsne = TSNE(
                n_components=3,
                perplexity=perplexity,
                random_state=42,
                n_iter=config.get('iterations', 1000)
            )
            embedding = tsne.fit_transform(X_reduced)
            
        elif algorithm == "umap":
            # For now, use PCA as UMAP equivalent (can be enhanced later)
            pca = PCA(n_components=3)
            embedding = pca.fit_transform(X_scaled)
        else:
            # Default to PCA
            pca = PCA(n_components=3)
            embedding = pca.fit_transform(X_scaled)
        
        # Clustering
        clustering = config.get('clustering', 'kmeans')
        if clustering == "kmeans":
            n_clusters = min(config.get('clusters', 3), len(X_scaled))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(X_scaled)
        elif clustering == "dbscan":
            dbscan = DBSCAN(eps=0.5, min_samples=5)
            cluster_labels = dbscan.fit_predict(X_scaled)
        else:
            # Default to k-means
            n_clusters = min(config.get('clusters', 3), len(X_scaled))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(X_scaled)
        
        # Anomaly detection
        isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        anomaly_labels = isolation_forest.fit_predict(X_scaled)
        anomalies = [str(i) for i, label in enumerate(anomaly_labels) if label == -1]
        
        # Generate colors for clusters
        colors = self._generate_cluster_colors(cluster_labels)
        
        # Create points
        points = []
        for i, (row_data, pos, cluster, color) in enumerate(zip(data, embedding, cluster_labels, colors)):
            points.append(Point3D(
                id=str(i),
                position=[float(pos[0]), float(pos[1]), float(pos[2])],
                color=color,
                cluster=int(cluster) if cluster >= 0 else -1,
                originalData=row_data
            ))
        
        # Create clusters
        clusters = []
        unique_clusters = np.unique(cluster_labels)
        for cluster_id in unique_clusters:
            if cluster_id >= 0:  # Ignore noise points (-1)
                cluster_points = [p for p in points if p.cluster == cluster_id]
                if cluster_points:
                    # Calculate cluster center
                    center_pos = np.mean([p.position for p in cluster_points], axis=0)
                    clusters.append(Cluster(
                        id=int(cluster_id),
                        color=cluster_points[0].color,
                        center=[float(center_pos[0]), float(center_pos[1]), float(center_pos[2])],
                        points=[p.id for p in cluster_points]
                    ))
        
        return ProcessingResult(
            points=points,
            clusters=clusters,
            anomalies=anomalies
        )
    
    def _generate_cluster_colors(self, cluster_labels: np.ndarray) -> List[str]:
        """Generate colors for clusters"""
        color_palette = [
            "#3B82F6",  # Blue
            "#8B5CF6",  # Purple
            "#10B981",  # Green
            "#F59E0B",  # Orange
            "#EF4444",  # Red
            "#06B6D4",  # Cyan
            "#F97316",  # Orange
            "#84CC16",  # Lime
            "#EC4899",  # Pink
            "#6366F1",  # Indigo
        ]
        
        colors = []
        unique_clusters = np.unique(cluster_labels)
        cluster_color_map = {}
        
        for i, cluster_id in enumerate(unique_clusters):
            if cluster_id >= 0:  # Valid cluster
                cluster_color_map[cluster_id] = color_palette[i % len(color_palette)]
            else:  # Noise points
                cluster_color_map[cluster_id] = "#6B7280"  # Gray
        
        for label in cluster_labels:
            colors.append(cluster_color_map[label])
        
        return colors