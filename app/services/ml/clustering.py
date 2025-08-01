"""
Advanced clustering algorithms with optimization and validation.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from sklearn.cluster import (
    KMeans, 
    DBSCAN, 
    AgglomerativeClustering,
    MeanShift,
    SpectralClustering,
)
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
import logging

try:
    import hdbscan
    HAS_HDBSCAN = True
except ImportError:
    HAS_HDBSCAN = False

from .base import MLAlgorithmBase, AlgorithmType, ProcessingContext, AlgorithmResult

logger = logging.getLogger(__name__)


class KMeansClusterer(MLAlgorithmBase):
    """
    Advanced K-Means clustering with automatic K selection.
    """
    
    def __init__(self, **params):
        """Initialize K-Means clusterer."""
        super().__init__(AlgorithmType.CLUSTERING, "K-Means")
        self.set_params(**params)
        self.model = None
        self.optimal_k = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "KMeansClusterer":
        """Fit K-Means model with optional K optimization."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_clusters': 3,
            'init': 'k-means++',
            'max_iter': 300,
            'tol': 1e-4,
            'random_state': 42,
            'n_init': 10,
            'algorithm': 'lloyd',
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Auto-select optimal K if requested
        if params.get('auto_k', False):
            optimal_k = await self._find_optimal_k(data, params)
            params['n_clusters'] = optimal_k
            self.optimal_k = optimal_k
        
        # Ensure valid K
        max_k = min(params['n_clusters'], n_samples - 1)
        params['n_clusters'] = max(2, max_k)
        
        # Optimize for large datasets
        if n_samples > 10000:
            params['algorithm'] = 'elkan'
            params['n_init'] = 5  # Reduce for speed
        
        self.model = KMeans(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"K-Means configured with k={params['n_clusters']} for {n_samples} samples")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Perform K-Means clustering."""
        if not self.is_fitted or self.model is None:
            raise ValueError("K-Means model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        cluster_labels = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_predict, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {}
        
        if len(np.unique(cluster_labels)) > 1:
            try:
                performance_metrics.update({
                    'silhouette_score': float(silhouette_score(data, cluster_labels)),
                    'calinski_harabasz_score': float(calinski_harabasz_score(data, cluster_labels)),
                    'davies_bouldin_score': float(davies_bouldin_score(data, cluster_labels)),
                    'inertia': float(self.model.inertia_),
                    'n_iter': int(self.model.n_iter_),
                })
            except Exception as e:
                logger.warning(f"Failed to calculate clustering metrics: {e}")
        
        # Cluster centers and statistics
        cluster_centers = self.model.cluster_centers_
        unique_labels, counts = np.unique(cluster_labels, return_counts=True)
        
        performance_metrics.update({
            'n_clusters_found': len(unique_labels),
            'cluster_sizes': counts.tolist(),
            'mean_cluster_size': float(np.mean(counts)),
            'std_cluster_size': float(np.std(counts)),
        })
        
        return AlgorithmResult(
            data=cluster_labels,
            metadata={
                'algorithm': 'K-Means',
                'n_clusters': self.model.n_clusters,
                'n_samples': len(cluster_labels),
                'cluster_centers': cluster_centers.tolist(),
                'optimal_k': self.optimal_k,
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )
    
    async def _find_optimal_k(self, data: np.ndarray, params: Dict[str, Any]) -> int:
        """Find optimal number of clusters using elbow method and silhouette analysis."""
        n_samples = data.shape[0]
        
        # K range
        k_min = params.get('k_min', 2)
        k_max = params.get('k_max', min(10, n_samples // 2))
        k_range = range(k_min, k_max + 1)
        
        inertias = []
        silhouette_scores = []
        
        for k in k_range:
            # Create temporary model
            temp_params = params.copy()
            temp_params.update({
                'n_clusters': k,
                'n_init': 3,  # Reduce for speed during optimization
            })
            temp_model = KMeans(**{key: val for key, val in temp_params.items() 
                                 if key in KMeans().get_params()})
            
            # Fit and evaluate
            labels = temp_model.fit_predict(data)
            inertias.append(temp_model.inertia_)
            
            if len(np.unique(labels)) > 1:
                silhouette_scores.append(silhouette_score(data, labels))
            else:
                silhouette_scores.append(-1)
        
        # Find optimal K using elbow method
        optimal_k_elbow = self._find_elbow_point(list(k_range), inertias)
        
        # Find optimal K using silhouette score
        optimal_k_silhouette = k_range[np.argmax(silhouette_scores)]
        
        # Choose the best K (prefer silhouette if significantly different)
        if silhouette_scores[optimal_k_silhouette - k_min] > 0.5:
            optimal_k = optimal_k_silhouette
        else:
            optimal_k = optimal_k_elbow
        
        logger.info(f"Optimal K selection: elbow={optimal_k_elbow}, silhouette={optimal_k_silhouette}, chosen={optimal_k}")
        
        return optimal_k
    
    def _find_elbow_point(self, k_values: List[int], inertias: List[float]) -> int:
        """Find elbow point in the inertia curve."""
        if len(k_values) < 3:
            return k_values[0]
        
        # Calculate second derivative to find elbow
        diffs = np.diff(inertias)
        second_diffs = np.diff(diffs)
        
        if len(second_diffs) == 0:
            return k_values[0]
        
        # Find the point with maximum curvature
        elbow_idx = np.argmax(second_diffs) + 1  # +1 because of double diff
        
        return k_values[min(elbow_idx, len(k_values) - 1)]


class DBSCANClusterer(MLAlgorithmBase):
    """
    DBSCAN clustering with parameter optimization.
    """
    
    def __init__(self, **params):
        """Initialize DBSCAN clusterer."""
        super().__init__(AlgorithmType.CLUSTERING, "DBSCAN")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "DBSCANClusterer":
        """Fit DBSCAN model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'eps': 0.5,
            'min_samples': 5,
            'metric': 'euclidean',
            'algorithm': 'auto',
            'n_jobs': -1,
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Auto-optimize parameters if requested
        if params.get('auto_params', False):
            optimal_eps, optimal_min_samples = await self._optimize_dbscan_params(data, params)
            params['eps'] = optimal_eps
            params['min_samples'] = optimal_min_samples
        
        # Adjust min_samples for small datasets
        params['min_samples'] = min(params['min_samples'], max(2, n_samples // 10))
        
        self.model = DBSCAN(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"DBSCAN configured with eps={params['eps']}, min_samples={params['min_samples']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Perform DBSCAN clustering."""
        if not self.is_fitted or self.model is None:
            raise ValueError("DBSCAN model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        cluster_labels = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_predict, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {}
        
        unique_labels = np.unique(cluster_labels)
        n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
        n_noise = np.sum(cluster_labels == -1)
        
        if n_clusters > 1:
            # Only calculate silhouette for non-noise points
            non_noise_mask = cluster_labels != -1
            if np.sum(non_noise_mask) > 1 and len(np.unique(cluster_labels[non_noise_mask])) > 1:
                try:
                    performance_metrics.update({
                        'silhouette_score': float(silhouette_score(
                            data[non_noise_mask], 
                            cluster_labels[non_noise_mask]
                        )),
                        'calinski_harabasz_score': float(calinski_harabasz_score(
                            data[non_noise_mask], 
                            cluster_labels[non_noise_mask]
                        )),
                        'davies_bouldin_score': float(davies_bouldin_score(
                            data[non_noise_mask], 
                            cluster_labels[non_noise_mask]
                        )),
                    })
                except Exception as e:
                    logger.warning(f"Failed to calculate clustering metrics: {e}")
        
        # Cluster statistics
        cluster_sizes = []
        for label in unique_labels:
            if label != -1:  # Exclude noise
                cluster_sizes.append(np.sum(cluster_labels == label))
        
        performance_metrics.update({
            'n_clusters_found': n_clusters,
            'n_noise_points': n_noise,
            'noise_ratio': float(n_noise / len(cluster_labels)),
            'cluster_sizes': cluster_sizes,
            'mean_cluster_size': float(np.mean(cluster_sizes)) if cluster_sizes else 0.0,
        })
        
        return AlgorithmResult(
            data=cluster_labels,
            metadata={
                'algorithm': 'DBSCAN',
                'eps': self.model.eps,
                'min_samples': self.model.min_samples,
                'n_samples': len(cluster_labels),
                'core_sample_indices': self.model.core_sample_indices_.tolist(),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )
    
    async def _optimize_dbscan_params(
        self, 
        data: np.ndarray, 
        base_params: Dict[str, Any]
    ) -> Tuple[float, int]:
        """Optimize DBSCAN parameters using k-distance graph method."""
        from sklearn.neighbors import NearestNeighbors
        
        # Default parameter ranges
        eps_range = base_params.get('eps_range', [0.1, 0.3, 0.5, 0.7, 1.0])
        min_samples_range = base_params.get('min_samples_range', [3, 5, 7, 10])
        
        best_score = -1
        best_eps = base_params['eps']
        best_min_samples = base_params['min_samples']
        
        # Use k-distance graph to estimate eps
        k = min(5, data.shape[0] - 1)
        nbrs = NearestNeighbors(n_neighbors=k).fit(data)
        distances, indices = nbrs.kneighbors(data)
        distances = np.sort(distances[:, k-1], axis=0)
        
        # Find knee point in k-distance graph
        knee_eps = distances[int(len(distances) * 0.95)]  # 95th percentile
        eps_range = [knee_eps * factor for factor in [0.5, 0.75, 1.0, 1.25, 1.5]]
        
        # Grid search
        for eps in eps_range:
            for min_samples in min_samples_range:
                if min_samples >= data.shape[0]:
                    continue
                
                try:
                    # Test parameters
                    temp_model = DBSCAN(eps=eps, min_samples=min_samples)
                    labels = temp_model.fit_predict(data)
                    
                    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
                    n_noise = list(labels).count(-1)
                    
                    if n_clusters < 2:  # Need at least 2 clusters
                        continue
                    
                    # Score based on silhouette and noise ratio
                    non_noise_mask = labels != -1
                    if np.sum(non_noise_mask) > 1:
                        silhouette = silhouette_score(data[non_noise_mask], labels[non_noise_mask])
                        noise_ratio = n_noise / len(labels)
                        
                        # Combined score (higher silhouette, lower noise ratio)
                        score = silhouette * (1 - noise_ratio)
                        
                        if score > best_score:
                            best_score = score
                            best_eps = eps
                            best_min_samples = min_samples
                
                except Exception as e:
                    continue
        
        logger.info(f"DBSCAN optimization: best_eps={best_eps}, best_min_samples={best_min_samples}, score={best_score}")
        
        return best_eps, best_min_samples


class HDBSCANClusterer(MLAlgorithmBase):
    """
    HDBSCAN clustering implementation.
    """
    
    def __init__(self, **params):
        """Initialize HDBSCAN clusterer."""
        super().__init__(AlgorithmType.CLUSTERING, "HDBSCAN")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "HDBSCANClusterer":
        """Fit HDBSCAN model."""
        if not HAS_HDBSCAN:
            raise ImportError("HDBSCAN not available. Install hdbscan package.")
        
        start_time = time.time()
        
        # Default parameters
        params = {
            'min_cluster_size': 5,
            'min_samples': None,
            'cluster_selection_epsilon': 0.0,
            'alpha': 1.0,
            'cluster_selection_method': 'eom',
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Adjust for small datasets
        params['min_cluster_size'] = min(params['min_cluster_size'], max(2, n_samples // 10))
        
        self.model = hdbscan.HDBSCAN(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"HDBSCAN configured with min_cluster_size={params['min_cluster_size']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Perform HDBSCAN clustering."""
        if not self.is_fitted or self.model is None:
            raise ValueError("HDBSCAN model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        cluster_labels = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_predict, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {}
        
        unique_labels = np.unique(cluster_labels)
        n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
        n_noise = np.sum(cluster_labels == -1)
        
        if n_clusters > 1:
            non_noise_mask = cluster_labels != -1
            if np.sum(non_noise_mask) > 1:
                try:
                    performance_metrics.update({
                        'silhouette_score': float(silhouette_score(
                            data[non_noise_mask], 
                            cluster_labels[non_noise_mask]
                        )),
                    })
                except Exception as e:
                    logger.warning(f"Failed to calculate clustering metrics: {e}")
        
        # HDBSCAN specific metrics
        if hasattr(self.model, 'cluster_persistence_'):
            performance_metrics['cluster_persistence'] = self.model.cluster_persistence_.tolist()
        
        if hasattr(self.model, 'probabilities_'):
            probabilities = self.model.probabilities_
            performance_metrics.update({
                'mean_membership_probability': float(np.mean(probabilities)),
                'min_membership_probability': float(np.min(probabilities)),
            })
        
        performance_metrics.update({
            'n_clusters_found': n_clusters,
            'n_noise_points': n_noise,
            'noise_ratio': float(n_noise / len(cluster_labels)),
        })
        
        return AlgorithmResult(
            data=cluster_labels,
            metadata={
                'algorithm': 'HDBSCAN',
                'min_cluster_size': self.model.min_cluster_size,
                'n_samples': len(cluster_labels),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class AgglomerativeClusterer(MLAlgorithmBase):
    """
    Agglomerative Hierarchical Clustering.
    """
    
    def __init__(self, **params):
        """Initialize Agglomerative clusterer."""
        super().__init__(AlgorithmType.CLUSTERING, "Agglomerative")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "AgglomerativeClusterer":
        """Fit Agglomerative model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_clusters': 3,
            'linkage': 'ward',
            'distance_threshold': None,
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Adjust for small datasets
        if params['distance_threshold'] is None:
            params['n_clusters'] = min(params['n_clusters'], max(2, n_samples - 1))
        
        self.model = AgglomerativeClustering(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"Agglomerative configured with {params['linkage']} linkage")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Perform Agglomerative clustering."""
        if not self.is_fitted or self.model is None:
            raise ValueError("Agglomerative model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        cluster_labels = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_predict, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {}
        
        if len(np.unique(cluster_labels)) > 1:
            try:
                performance_metrics.update({
                    'silhouette_score': float(silhouette_score(data, cluster_labels)),
                    'calinski_harabasz_score': float(calinski_harabasz_score(data, cluster_labels)),
                    'davies_bouldin_score': float(davies_bouldin_score(data, cluster_labels)),
                })
            except Exception as e:
                logger.warning(f"Failed to calculate clustering metrics: {e}")
        
        unique_labels, counts = np.unique(cluster_labels, return_counts=True)
        performance_metrics.update({
            'n_clusters_found': len(unique_labels),
            'cluster_sizes': counts.tolist(),
        })
        
        return AlgorithmResult(
            data=cluster_labels,
            metadata={
                'algorithm': 'Agglomerative',
                'n_clusters': self.model.n_clusters,
                'linkage': self.model.linkage,
                'n_samples': len(cluster_labels),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class GaussianMixtureClusterer(MLAlgorithmBase):
    """
    Gaussian Mixture Model clustering.
    """
    
    def __init__(self, **params):
        """Initialize Gaussian Mixture clusterer."""
        super().__init__(AlgorithmType.CLUSTERING, "Gaussian Mixture")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "GaussianMixtureClusterer":
        """Fit Gaussian Mixture model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_components': 3,
            'covariance_type': 'full',
            'max_iter': 100,
            'random_state': 42,
            'init_params': 'kmeans',
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Adjust for small datasets
        params['n_components'] = min(params['n_components'], max(2, n_samples // 2))
        
        # Choose covariance type based on data size
        if n_samples < 100:
            params['covariance_type'] = 'spherical'
        elif n_samples < 500:
            params['covariance_type'] = 'diag'
        
        self.model = GaussianMixture(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"Gaussian Mixture configured with {params['n_components']} components")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Perform Gaussian Mixture clustering."""
        if not self.is_fitted or self.model is None:
            raise ValueError("Gaussian Mixture model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        self.model.fit(data)
        cluster_labels = self.model.predict(data)
        probabilities = self.model.predict_proba(data)
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {
            'aic': float(self.model.aic(data)),
            'bic': float(self.model.bic(data)),
            'log_likelihood': float(self.model.score(data) * len(data)),
            'n_iter': int(self.model.n_iter_),
            'converged': bool(self.model.converged_),
        }
        
        # Membership probabilities
        performance_metrics.update({
            'mean_membership_probability': float(np.mean(np.max(probabilities, axis=1))),
            'min_membership_probability': float(np.min(np.max(probabilities, axis=1))),
        })
        
        if len(np.unique(cluster_labels)) > 1:
            try:
                performance_metrics.update({
                    'silhouette_score': float(silhouette_score(data, cluster_labels)),
                    'calinski_harabasz_score': float(calinski_harabasz_score(data, cluster_labels)),
                    'davies_bouldin_score': float(davies_bouldin_score(data, cluster_labels)),
                })
            except Exception as e:
                logger.warning(f"Failed to calculate clustering metrics: {e}")
        
        unique_labels, counts = np.unique(cluster_labels, return_counts=True)
        performance_metrics.update({
            'n_clusters_found': len(unique_labels),
            'cluster_sizes': counts.tolist(),
        })
        
        return AlgorithmResult(
            data=cluster_labels,
            metadata={
                'algorithm': 'Gaussian Mixture',
                'n_components': self.model.n_components,
                'covariance_type': self.model.covariance_type,
                'n_samples': len(cluster_labels),
                'cluster_probabilities': probabilities.tolist(),
                'means': self.model.means_.tolist(),
                'weights': self.model.weights_.tolist(),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )