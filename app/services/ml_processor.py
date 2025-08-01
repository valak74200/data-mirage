"""
Machine Learning processor service for data analysis and 3D visualization.
Integrates scikit-learn algorithms for dimensionality reduction, clustering, and anomaly detection.
"""

import asyncio
import time
import uuid
from typing import List, Dict, Any, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
import redis.asyncio as redis
import json
import logging

try:
    import umap
    HAS_UMAP = True
except ImportError:
    HAS_UMAP = False

try:
    import hdbscan
    HAS_HDBSCAN = True
except ImportError:
    HAS_HDBSCAN = False

from schemas.ml import (
    MLConfig,
    ProcessingResult,
    DataPoint,
    Cluster,
    ProcessingMetadata,
    ProcessingProgress,
    ModelPerformance,
)
from core.config import settings

logger = logging.getLogger(__name__)


class MLProcessingError(Exception):
    """ML processing related errors."""
    pass


class UnsupportedMethodError(MLProcessingError):
    """Unsupported ML method error."""
    pass


class InsufficientDataError(MLProcessingError):
    """Insufficient data for processing error."""
    pass


class MLProcessor:
    """
    Machine Learning processor for data analysis and visualization.
    
    Features:
    - Dimensionality reduction (t-SNE, UMAP, PCA)
    - Clustering (K-Means, DBSCAN, HDBSCAN, Agglomerative)
    - Anomaly detection (Isolation Forest)
    - 3D coordinate computation
    - Performance metrics calculation
    - Progress tracking via Redis
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        """
        Initialize ML processor.
        
        Args:
            redis_client: Redis client for progress tracking
        """
        self.redis_client = redis_client
        self.color_palette = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57",
            "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3", "#FF9F43",
            "#FFC312", "#C4E538", "#12CBC4", "#FDA7DF", "#ED4C67"
        ]
    
    async def process_dataset(
        self,
        data: List[Dict[str, Any]],
        config: MLConfig,
        dataset_id: Optional[str] = None,
    ) -> ProcessingResult:
        """
        Process dataset with ML algorithms.
        
        Args:
            data: Raw dataset as list of dictionaries
            config: ML processing configuration
            dataset_id: Dataset ID for progress tracking
            
        Returns:
            Processing results with 3D coordinates and clusters
            
        Raises:
            MLProcessingError: If processing fails
            InsufficientDataError: If not enough data
            UnsupportedMethodError: If method not supported
        """
        start_time = time.time()
        
        try:
            # Validate input data
            if not data or len(data) < 10:
                raise InsufficientDataError("Dataset must have at least 10 rows")
            
            # Update progress
            await self._update_progress(dataset_id, "preprocessing", 10, "Preprocessing data...")
            
            # Preprocess data
            df, feature_columns, preprocessing_steps = await self._preprocess_data(data, config)
            
            # Update progress
            await self._update_progress(dataset_id, "reduction", 30, "Performing dimensionality reduction...")
            
            # Dimensionality reduction
            reduced_data = await self._perform_reduction(df, config)
            
            # Update progress
            await self._update_progress(dataset_id, "clustering", 60, "Performing clustering...")
            
            # Clustering
            cluster_labels = await self._perform_clustering(reduced_data, config)
            
            # Update progress
            await self._update_progress(dataset_id, "anomalies", 80, "Detecting anomalies...")
            
            # Anomaly detection
            anomaly_indices = []
            if config.detect_anomalies:
                anomaly_indices = await self._detect_anomalies(df, config)
            
            # Update progress
            await self._update_progress(dataset_id, "finalizing", 90, "Finalizing results...")
            
            # Create data points
            points = await self._create_data_points(
                data, reduced_data, cluster_labels, anomaly_indices, config
            )
            
            # Create cluster information
            clusters = await self._create_cluster_info(cluster_labels, reduced_data, points)
            
            # Calculate performance metrics
            performance = await self._calculate_performance_metrics(
                reduced_data, cluster_labels, df, config
            )
            
            # Create metadata
            processing_time = time.time() - start_time
            metadata = ProcessingMetadata(
                total_points=len(points),
                processing_time=processing_time,
                reduction_method=config.reduction_method.value,
                clustering_method=config.clustering_method.value,
                features_used=feature_columns,
                preprocessing_steps=preprocessing_steps,
            )
            
            # Update progress
            await self._update_progress(dataset_id, "completed", 100, "Processing completed")
            
            return ProcessingResult(
                points=points,
                clusters=clusters,
                anomalies=[str(i) for i in anomaly_indices],
                metadata=metadata,
            )
            
        except (InsufficientDataError, UnsupportedMethodError):
            raise
        except Exception as e:
            logger.error(f"ML processing failed: {str(e)}")
            await self._update_progress(dataset_id, "error", 0, f"Processing failed: {str(e)}")
            raise MLProcessingError(f"Processing failed: {str(e)}")
    
    async def _preprocess_data(
        self,
        data: List[Dict[str, Any]],
        config: MLConfig,
    ) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """
        Preprocess data for ML algorithms.
        
        Args:
            data: Raw data
            config: ML configuration
            
        Returns:
            Tuple of (processed_dataframe, feature_columns, preprocessing_steps)
        """
        preprocessing_steps = []
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        preprocessing_steps.append("Converted to DataFrame")
        
        # Sample data if too large
        if config.max_samples and len(df) > config.max_samples:
            df = df.sample(n=config.max_samples, random_state=config.random_state)
            preprocessing_steps.append(f"Sampled {config.max_samples} rows")
        
        # Select feature columns
        if config.feature_columns:
            feature_columns = [col for col in config.feature_columns if col in df.columns]
        else:
            # Auto-select numeric columns
            numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
            feature_columns = numeric_columns
        
        if not feature_columns:
            raise MLProcessingError("No numeric features found for processing")
        
        # Extract feature data
        feature_df = df[feature_columns].copy()
        
        # Handle missing values
        if config.handle_missing == "drop":
            feature_df = feature_df.dropna()
            preprocessing_steps.append("Dropped rows with missing values")
        elif config.handle_missing == "mean":
            feature_df = feature_df.fillna(feature_df.mean())
            preprocessing_steps.append("Filled missing values with mean")
        elif config.handle_missing == "median":
            feature_df = feature_df.fillna(feature_df.median())
            preprocessing_steps.append("Filled missing values with median")
        elif config.handle_missing == "zero":
            feature_df = feature_df.fillna(0)
            preprocessing_steps.append("Filled missing values with zero")
        
        # Normalize features
        if config.normalize_features:
            scaler = StandardScaler()
            feature_df = pd.DataFrame(
                scaler.fit_transform(feature_df),
                columns=feature_df.columns,
                index=feature_df.index
            )
            preprocessing_steps.append("Normalized features with StandardScaler")
        
        return feature_df, feature_columns, preprocessing_steps
    
    async def _perform_reduction(
        self,
        df: pd.DataFrame,
        config: MLConfig,
    ) -> np.ndarray:
        """
        Perform dimensionality reduction.
        
        Args:
            df: Feature DataFrame
            config: ML configuration
            
        Returns:
            Reduced data as numpy array
        """
        method = config.reduction_method.value
        
        if method == "pca":
            n_components = 3
            if config.pca_config:
                n_components = config.pca_config.n_components
            
            reducer = PCA(
                n_components=n_components,
                random_state=config.random_state,
                whiten=config.pca_config.whiten if config.pca_config else False,
            )
            
        elif method == "tsne":
            perplexity = 30.0
            learning_rate = "auto"
            n_iter = 1000
            
            if config.tsne_config:
                perplexity = config.tsne_config.perplexity
                learning_rate = config.tsne_config.learning_rate
                n_iter = config.tsne_config.n_iter
            
            reducer = TSNE(
                n_components=3,
                perplexity=perplexity,
                learning_rate=learning_rate,
                n_iter=n_iter,
                random_state=config.random_state,
                metric=config.tsne_config.metric if config.tsne_config else "euclidean",
            )
            
        elif method == "umap":
            if not HAS_UMAP:
                raise UnsupportedMethodError("UMAP not available. Install umap-learn package.")
            
            n_neighbors = 15
            min_dist = 0.1
            
            if config.umap_config:
                n_neighbors = config.umap_config.n_neighbors
                min_dist = config.umap_config.min_dist
            
            reducer = umap.UMAP(
                n_components=3,
                n_neighbors=n_neighbors,
                min_dist=min_dist,
                random_state=config.random_state,
                metric=config.umap_config.metric if config.umap_config else "euclidean",
            )
            
        else:
            raise UnsupportedMethodError(f"Reduction method '{method}' not supported")
        
        # Perform reduction
        reduced_data = reducer.fit_transform(df.values)
        
        # Ensure 3D output
        if reduced_data.shape[1] < 3:
            # Pad with zeros if less than 3 dimensions
            padding = np.zeros((reduced_data.shape[0], 3 - reduced_data.shape[1]))
            reduced_data = np.hstack([reduced_data, padding])
        
        return reduced_data
    
    async def _perform_clustering(
        self,
        reduced_data: np.ndarray,
        config: MLConfig,
    ) -> np.ndarray:
        """
        Perform clustering on reduced data.
        
        Args:
            reduced_data: Reduced dimensionality data
            config: ML configuration
            
        Returns:
            Cluster labels as numpy array
        """
        method = config.clustering_method.value
        
        if method == "kmeans":
            n_clusters = 3
            if config.kmeans_config:
                n_clusters = config.kmeans_config.n_clusters
            
            clusterer = KMeans(
                n_clusters=n_clusters,
                random_state=config.random_state,
                init=config.kmeans_config.init if config.kmeans_config else "k-means++",
                max_iter=config.kmeans_config.max_iter if config.kmeans_config else 300,
            )
            
        elif method == "dbscan":
            eps = 0.5
            min_samples = 5
            
            if config.dbscan_config:
                eps = config.dbscan_config.eps
                min_samples = config.dbscan_config.min_samples
            
            clusterer = DBSCAN(
                eps=eps,
                min_samples=min_samples,
                metric=config.dbscan_config.metric if config.dbscan_config else "euclidean",
            )
            
        elif method == "hdbscan":
            if not HAS_HDBSCAN:
                raise UnsupportedMethodError("HDBSCAN not available. Install hdbscan package.")
            
            min_cluster_size = 5
            if config.hdbscan_config:
                min_cluster_size = config.hdbscan_config.min_cluster_size
            
            clusterer = hdbscan.HDBSCAN(
                min_cluster_size=min_cluster_size,
                min_samples=config.hdbscan_config.min_samples if config.hdbscan_config else None,
            )
            
        elif method == "agglomerative":
            n_clusters = 3
            if config.agglomerative_config:
                n_clusters = config.agglomerative_config.n_clusters
            
            clusterer = AgglomerativeClustering(
                n_clusters=n_clusters,
                linkage=config.agglomerative_config.linkage if config.agglomerative_config else "ward",
            )
            
        else:
            raise UnsupportedMethodError(f"Clustering method '{method}' not supported")
        
        # Perform clustering
        cluster_labels = clusterer.fit_predict(reduced_data)
        
        return cluster_labels
    
    async def _detect_anomalies(
        self,
        df: pd.DataFrame,
        config: MLConfig,
    ) -> List[int]:
        """
        Detect anomalies in the data.
        
        Args:
            df: Feature DataFrame
            config: ML configuration
            
        Returns:
            List of anomaly indices
        """
        contamination = 0.1
        if config.anomaly_config:
            contamination = config.anomaly_config.contamination
        
        detector = IsolationForest(
            contamination=contamination,
            random_state=config.random_state,
        )
        
        anomaly_labels = detector.fit_predict(df.values)
        anomaly_indices = np.where(anomaly_labels == -1)[0].tolist()
        
        return anomaly_indices
    
    async def _create_data_points(
        self,
        original_data: List[Dict[str, Any]],
        reduced_data: np.ndarray,
        cluster_labels: np.ndarray,
        anomaly_indices: List[int],
        config: MLConfig,
    ) -> List[DataPoint]:
        """
        Create 3D data points from processing results.
        
        Args:
            original_data: Original data
            reduced_data: 3D coordinates
            cluster_labels: Cluster assignments
            anomaly_indices: Anomaly indices
            config: ML configuration
            
        Returns:
            List of DataPoint objects
        """
        points = []
        
        for i, (coords, cluster_id, row_data) in enumerate(
            zip(reduced_data, cluster_labels, original_data)
        ):
            # Determine color
            if i in anomaly_indices:
                color = "#FF0000"  # Red for anomalies
            elif cluster_id == -1:  # Noise points (DBSCAN)
                color = "#808080"  # Gray for noise
            else:
                color = self.color_palette[cluster_id % len(self.color_palette)]
            
            # Determine size
            size = 1.0
            if config.size_column and config.size_column in row_data:
                try:
                    size_value = float(row_data[config.size_column])
                    # Normalize size to 0.5-2.0 range
                    size = max(0.5, min(2.0, size_value / 100.0))
                except (ValueError, TypeError):
                    size = 1.0
            
            point = DataPoint(
                id=str(uuid.uuid4()),
                position=(float(coords[0]), float(coords[1]), float(coords[2])),
                color=color,
                size=size,
                cluster=int(cluster_id),
                is_anomaly=i in anomaly_indices,
                original_data=row_data,
            )
            
            points.append(point)
        
        return points
    
    async def _create_cluster_info(
        self,
        cluster_labels: np.ndarray,
        reduced_data: np.ndarray,
        points: List[DataPoint],
    ) -> List[Cluster]:
        """
        Create cluster information.
        
        Args:
            cluster_labels: Cluster assignments
            reduced_data: 3D coordinates
            points: Data points
            
        Returns:
            List of Cluster objects
        """
        clusters = []
        unique_labels = np.unique(cluster_labels)
        
        for label in unique_labels:
            if label == -1:  # Skip noise points
                continue
            
            # Get points in this cluster
            cluster_indices = np.where(cluster_labels == label)[0]
            cluster_points = reduced_data[cluster_indices]
            
            # Calculate cluster center
            center = np.mean(cluster_points, axis=0)
            
            # Get cluster color from first point
            cluster_color = self.color_palette[label % len(self.color_palette)]
            
            cluster = Cluster(
                id=int(label),
                color=cluster_color,
                count=len(cluster_indices),
                center=(float(center[0]), float(center[1]), float(center[2])),
                label=f"Cluster {label}",
            )
            
            clusters.append(cluster)
        
        return clusters
    
    async def _calculate_performance_metrics(
        self,
        reduced_data: np.ndarray,
        cluster_labels: np.ndarray,
        original_df: pd.DataFrame,
        config: MLConfig,
    ) -> ModelPerformance:
        """
        Calculate model performance metrics.
        
        Args:
            reduced_data: Reduced data
            cluster_labels: Cluster labels
            original_df: Original feature DataFrame
            config: ML configuration
            
        Returns:
            ModelPerformance object
        """
        metrics = {}
        
        # Only calculate clustering metrics if we have valid clusters
        if len(np.unique(cluster_labels)) > 1 and -1 not in cluster_labels:
            try:
                metrics["silhouette_score"] = float(silhouette_score(reduced_data, cluster_labels))
                metrics["calinski_harabasz_score"] = float(calinski_harabasz_score(reduced_data, cluster_labels))
                metrics["davies_bouldin_score"] = float(davies_bouldin_score(reduced_data, cluster_labels))
            except Exception as e:
                logger.warning(f"Failed to calculate clustering metrics: {e}")
        
        return ModelPerformance(**metrics)
    
    async def _update_progress(
        self,
        dataset_id: Optional[str],
        stage: str,
        progress: float,
        message: str,
    ):
        """
        Update processing progress in Redis.
        
        Args:
            dataset_id: Dataset ID
            stage: Current processing stage
            progress: Progress percentage
            message: Progress message
        """
        if not self.redis_client or not dataset_id:
            return
        
        try:
            progress_data = ProcessingProgress(
                dataset_id=dataset_id,
                stage=stage,
                progress=progress,
                message=message,
            )
            
            await self.redis_client.setex(
                f"processing:{dataset_id}",
                300,  # 5 minutes TTL
                progress_data.model_dump_json(),
            )
        except Exception as e:
            logger.warning(f"Failed to update progress: {e}")
    
    async def get_processing_progress(self, dataset_id: str) -> Optional[ProcessingProgress]:
        """
        Get processing progress for a dataset.
        
        Args:
            dataset_id: Dataset ID
            
        Returns:
            ProcessingProgress object if found
        """
        if not self.redis_client:
            return None
        
        try:
            progress_json = await self.redis_client.get(f"processing:{dataset_id}")
            if progress_json:
                return ProcessingProgress.model_validate_json(progress_json)
        except Exception as e:
            logger.warning(f"Failed to get progress: {e}")
        
        return None