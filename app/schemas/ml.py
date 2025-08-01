"""
Pydantic schemas for machine learning processing and results.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union, Tuple
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum


class ReductionMethod(str, Enum):
    """Dimensionality reduction methods."""
    TSNE = "tsne"
    UMAP = "umap"
    PCA = "pca"


class ClusteringMethod(str, Enum):
    """Clustering methods."""
    KMEANS = "kmeans"
    DBSCAN = "dbscan"
    HDBSCAN = "hdbscan"
    AGGLOMERATIVE = "agglomerative"


class MLConfigBase(BaseModel):
    """Base ML configuration schema."""
    
    reduction_method: ReductionMethod = Field(..., description="Dimensionality reduction method")
    clustering_method: ClusteringMethod = Field(..., description="Clustering method")
    detect_anomalies: bool = Field(True, description="Whether to detect anomalies")
    random_state: int = Field(42, description="Random state for reproducibility")


class TSNEConfig(BaseModel):
    """t-SNE specific configuration."""
    
    perplexity: float = Field(30.0, ge=5.0, le=50.0, description="t-SNE perplexity parameter")
    learning_rate: Union[float, str] = Field("auto", description="Learning rate")
    n_iter: int = Field(1000, ge=250, le=5000, description="Number of iterations")
    metric: str = Field("euclidean", description="Distance metric")
    
    @field_validator('learning_rate')
    @classmethod
    def validate_learning_rate(cls, v):
        if isinstance(v, str) and v != "auto":
            raise ValueError('Learning rate must be "auto" or a positive number')
        if isinstance(v, (int, float)) and v <= 0:
            raise ValueError('Learning rate must be positive')
        return v


class UMAPConfig(BaseModel):
    """UMAP specific configuration."""
    
    n_neighbors: int = Field(15, ge=2, le=100, description="Number of neighbors")
    min_dist: float = Field(0.1, ge=0.0, le=1.0, description="Minimum distance")
    metric: str = Field("euclidean", description="Distance metric")
    n_epochs: Optional[int] = Field(None, ge=50, le=1000, description="Number of epochs")


class PCAConfig(BaseModel):
    """PCA specific configuration."""
    
    n_components: int = Field(3, ge=2, le=10, description="Number of components")
    whiten: bool = Field(False, description="Whether to whiten the components")


class KMeansConfig(BaseModel):
    """K-Means clustering configuration."""
    
    n_clusters: int = Field(3, ge=2, le=20, description="Number of clusters")
    init: str = Field("k-means++", description="Initialization method")
    max_iter: int = Field(300, ge=100, le=1000, description="Maximum iterations")
    tol: float = Field(1e-4, description="Tolerance for convergence")


class DBSCANConfig(BaseModel):
    """DBSCAN clustering configuration."""
    
    eps: float = Field(0.5, gt=0, description="Maximum distance between samples")
    min_samples: int = Field(5, ge=1, description="Minimum samples in neighborhood")
    metric: str = Field("euclidean", description="Distance metric")


class HDBSCANConfig(BaseModel):
    """HDBSCAN clustering configuration."""
    
    min_cluster_size: int = Field(5, ge=2, description="Minimum cluster size")
    min_samples: Optional[int] = Field(None, ge=1, description="Minimum samples")
    cluster_selection_epsilon: float = Field(0.0, ge=0.0, description="Cluster selection epsilon")


class AgglomerativeConfig(BaseModel):
    """Agglomerative clustering configuration."""
    
    n_clusters: int = Field(3, ge=2, le=20, description="Number of clusters")
    linkage: str = Field("ward", description="Linkage criterion")
    distance_threshold: Optional[float] = Field(None, ge=0, description="Distance threshold")


class AnomalyDetectionConfig(BaseModel):
    """Anomaly detection configuration."""
    
    method: str = Field("isolation_forest", description="Anomaly detection method")
    contamination: float = Field(0.1, ge=0.01, le=0.5, description="Expected contamination ratio")
    random_state: int = Field(42, description="Random state")


class MLConfig(MLConfigBase):
    """Complete ML processing configuration."""
    
    # Method-specific configurations
    tsne_config: Optional[TSNEConfig] = Field(None, description="t-SNE configuration")
    umap_config: Optional[UMAPConfig] = Field(None, description="UMAP configuration")
    pca_config: Optional[PCAConfig] = Field(None, description="PCA configuration")
    
    kmeans_config: Optional[KMeansConfig] = Field(None, description="K-Means configuration")
    dbscan_config: Optional[DBSCANConfig] = Field(None, description="DBSCAN configuration")
    hdbscan_config: Optional[HDBSCANConfig] = Field(None, description="HDBSCAN configuration")
    agglomerative_config: Optional[AgglomerativeConfig] = Field(None, description="Agglomerative configuration")
    
    anomaly_config: Optional[AnomalyDetectionConfig] = Field(None, description="Anomaly detection configuration")
    
    # Column selection
    feature_columns: Optional[List[str]] = Field(None, description="Specific columns to use as features")
    color_column: Optional[str] = Field(None, description="Column to use for coloring")
    size_column: Optional[str] = Field(None, description="Column to use for sizing")
    label_column: Optional[str] = Field(None, description="Column to use for labeling")
    
    # Preprocessing options
    normalize_features: bool = Field(True, description="Whether to normalize features")
    handle_missing: str = Field("drop", description="How to handle missing values")
    
    # Performance options
    max_samples: Optional[int] = Field(None, ge=100, description="Maximum samples to process")
    use_parallel: bool = Field(True, description="Whether to use parallel processing")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "reduction_method": "tsne",
                "clustering_method": "kmeans",
                "detect_anomalies": True,
                "tsne_config": {
                    "perplexity": 30.0,
                    "learning_rate": "auto",
                    "n_iter": 1000
                },
                "kmeans_config": {
                    "n_clusters": 5,
                    "init": "k-means++",
                    "max_iter": 300
                },
                "color_column": "category",
                "normalize_features": True,
                "max_samples": 5000
            }
        }
    )
    
    @field_validator('handle_missing')
    @classmethod
    def validate_handle_missing(cls, v):
        allowed = ["drop", "mean", "median", "mode", "zero"]
        if v not in allowed:
            raise ValueError(f'handle_missing must be one of: {allowed}')
        return v


class DataPoint(BaseModel):
    """Schema for a 3D data point."""
    
    id: str = Field(..., description="Point unique identifier")
    position: Tuple[float, float, float] = Field(..., description="3D coordinates (x, y, z)")
    color: str = Field(..., description="Point color (hex)")
    size: float = Field(1.0, ge=0.1, le=10.0, description="Point size")
    cluster: int = Field(-1, description="Cluster assignment (-1 for noise)")
    is_anomaly: bool = Field(False, description="Whether point is an anomaly")
    original_data: Dict[str, Any] = Field(..., description="Original row data")
    
    model_config = ConfigDict(from_attributes=True)


class Cluster(BaseModel):
    """Schema for cluster information."""
    
    id: int = Field(..., description="Cluster ID")
    color: str = Field(..., description="Cluster color (hex)")
    count: int = Field(..., description="Number of points in cluster")
    center: Tuple[float, float, float] = Field(..., description="Cluster center coordinates")
    label: str = Field(..., description="Cluster label")
    
    model_config = ConfigDict(from_attributes=True)


class ClusterAnalysis(BaseModel):
    """Schema for cluster analysis and explanation."""
    
    cluster_id: int = Field(..., description="Cluster ID")
    explanation: str = Field(..., description="AI-generated explanation")
    characteristics: List[str] = Field(..., description="Key characteristics")
    data_points: int = Field(..., description="Number of data points")
    key_features: List[str] = Field(..., description="Most important features")
    representative_points: Optional[List[str]] = Field(None, description="IDs of representative points")
    
    model_config = ConfigDict(from_attributes=True)


class ProcessingMetadata(BaseModel):
    """Schema for processing metadata."""
    
    total_points: int = Field(..., description="Total number of data points")
    processing_time: float = Field(..., description="Processing time in seconds")
    reduction_method: str = Field(..., description="Reduction method used")
    clustering_method: str = Field(..., description="Clustering method used")
    features_used: List[str] = Field(..., description="Features used in processing")
    preprocessing_steps: List[str] = Field(..., description="Preprocessing steps applied")
    
    model_config = ConfigDict(from_attributes=True)


class ProcessingResult(BaseModel):
    """Schema for complete ML processing results."""
    
    points: List[DataPoint] = Field(..., description="3D data points")
    clusters: List[Cluster] = Field(..., description="Cluster information")
    anomalies: List[str] = Field(..., description="IDs of anomalous points")
    explanations: Optional[List[ClusterAnalysis]] = Field(None, description="AI-generated cluster explanations")
    metadata: ProcessingMetadata = Field(..., description="Processing metadata")
    
    model_config = ConfigDict(from_attributes=True)


class ProcessingRequest(BaseModel):
    """Schema for ML processing requests."""
    
    dataset_id: str = Field(..., description="Dataset ID to process")
    config: MLConfig = Field(..., description="Processing configuration")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "dataset_id": "dataset-uuid-here",
                "config": {
                    "reduction_method": "tsne",
                    "clustering_method": "kmeans",
                    "detect_anomalies": True,
                    "kmeans_config": {
                        "n_clusters": 5
                    }
                }
            }
        }
    )


class ProcessingProgress(BaseModel):
    """Schema for processing progress updates."""
    
    dataset_id: str = Field(..., description="Dataset ID being processed")
    stage: str = Field(..., description="Current processing stage")
    progress: float = Field(..., ge=0, le=100, description="Progress percentage")
    message: str = Field(..., description="Progress message")
    estimated_remaining: Optional[int] = Field(None, description="Estimated remaining seconds")
    
    model_config = ConfigDict(from_attributes=True)


class VisualizationConfig(BaseModel):
    """Schema for 3D visualization configuration."""
    
    point_size: float = Field(1.0, ge=0.1, le=5.0, description="Default point size")
    show_clusters: bool = Field(True, description="Whether to show cluster boundaries")
    show_anomalies: bool = Field(True, description="Whether to highlight anomalies")
    color_scheme: str = Field("default", description="Color scheme to use")
    animation_speed: float = Field(1.0, ge=0.1, le=5.0, description="Animation speed")
    camera_position: Optional[Tuple[float, float, float]] = Field(None, description="Initial camera position")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "point_size": 1.5,
                "show_clusters": True,
                "show_anomalies": True,
                "color_scheme": "viridis",
                "animation_speed": 1.2
            }
        }
    )


class ModelPerformance(BaseModel):
    """Schema for model performance metrics."""
    
    silhouette_score: Optional[float] = Field(None, description="Silhouette score for clustering")
    calinski_harabasz_score: Optional[float] = Field(None, description="Calinski-Harabasz score")
    davies_bouldin_score: Optional[float] = Field(None, description="Davies-Bouldin score")
    explained_variance_ratio: Optional[List[float]] = Field(None, description="Explained variance ratio for PCA")
    stress: Optional[float] = Field(None, description="Stress value for t-SNE")
    
    model_config = ConfigDict(from_attributes=True)