"""
Advanced dimensionality reduction algorithms.
"""

import asyncio
import time
from typing import Any, Dict, Optional, Union
import numpy as np
from sklearn.decomposition import PCA, KernelPCA
from sklearn.manifold import TSNE, MDS
import logging

try:
    import umap
    HAS_UMAP = True
except ImportError:
    HAS_UMAP = False

from .base import MLAlgorithmBase, AlgorithmType, ProcessingContext, AlgorithmResult

logger = logging.getLogger(__name__)


class TSNEReducer(MLAlgorithmBase):
    """
    Advanced t-SNE implementation with optimizations for large datasets.
    """
    
    def __init__(self, **params):
        """Initialize t-SNE reducer."""
        super().__init__(AlgorithmType.DIMENSIONALITY_REDUCTION, "t-SNE")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "TSNEReducer":
        """Fit t-SNE model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_components': 3,
            'perplexity': 30.0,
            'learning_rate': 'auto',
            'n_iter': 1000,
            'metric': 'euclidean',
            'random_state': 42,
            'verbose': 0,
            'n_jobs': -1,
        }
        params.update(self._params)
        params.update(kwargs)
        
        # Adjust parameters based on data size
        n_samples = data.shape[0]
        
        # Adjust perplexity for small datasets
        max_perplexity = min(params['perplexity'], (n_samples - 1) / 3)
        params['perplexity'] = max(5.0, max_perplexity)
        
        # Use PCA initialization for large datasets
        if n_samples > 10000:
            params['init'] = 'pca'
            params['n_iter'] = max(250, min(params['n_iter'], 500))
        
        # Early exaggeration adjustment
        if n_samples > 5000:
            params['early_exaggeration'] = 12.0
        
        self.model = TSNE(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"t-SNE configured for {n_samples} samples with perplexity={params['perplexity']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Transform data using t-SNE."""
        if not self.is_fitted or self.model is None:
            raise ValueError("t-SNE model not fitted")
        
        start_time = time.time()
        
        # t-SNE doesn't support separate transform, so we use fit_transform
        transformed_data = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_transform, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        kl_divergence = getattr(self.model, 'kl_divergence_', None)
        
        performance_metrics = {}
        if kl_divergence is not None:
            performance_metrics['kl_divergence'] = float(kl_divergence)
        
        # Calculate embedding quality metrics
        if data is not None and transformed_data is not None:
            embedding_variance = np.var(transformed_data, axis=0)
            performance_metrics.update({
                'embedding_variance_x': float(embedding_variance[0]),
                'embedding_variance_y': float(embedding_variance[1]),
                'embedding_variance_z': float(embedding_variance[2]) if len(embedding_variance) > 2 else 0.0,
                'total_variance': float(np.sum(embedding_variance)),
            })
        
        # Ensure 3D output
        if transformed_data.shape[1] < 3:
            padding = np.zeros((transformed_data.shape[0], 3 - transformed_data.shape[1]))
            transformed_data = np.hstack([transformed_data, padding])
        
        return AlgorithmResult(
            data=transformed_data,
            metadata={
                'algorithm': 't-SNE',
                'n_components': transformed_data.shape[1],
                'n_samples': transformed_data.shape[0],
                'perplexity': self.model.perplexity,
                'n_iter': self.model.n_iter,
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class UMAPReducer(MLAlgorithmBase):
    """
    UMAP (Uniform Manifold Approximation and Projection) implementation.
    """
    
    def __init__(self, **params):
        """Initialize UMAP reducer."""
        super().__init__(AlgorithmType.DIMENSIONALITY_REDUCTION, "UMAP")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "UMAPReducer":
        """Fit UMAP model."""
        if not HAS_UMAP:
            raise ImportError("UMAP not available. Install umap-learn package.")
        
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_components': 3,
            'n_neighbors': 15,
            'min_dist': 0.1,
            'metric': 'euclidean',
            'random_state': 42,
            'n_jobs': -1,
            'verbose': False,
        }
        params.update(self._params)
        params.update(kwargs)
        
        # Adjust parameters based on data size
        n_samples = data.shape[0]
        
        # Adjust n_neighbors for small datasets
        max_neighbors = min(params['n_neighbors'], n_samples - 1)
        params['n_neighbors'] = max(2, max_neighbors)
        
        # Optimize for large datasets
        if n_samples > 10000:
            params['low_memory'] = True
            params['n_epochs'] = 200
        
        self.model = umap.UMAP(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"UMAP configured for {n_samples} samples with n_neighbors={params['n_neighbors']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Transform data using UMAP."""
        if not self.is_fitted or self.model is None:
            raise ValueError("UMAP model not fitted")
        
        start_time = time.time()
        
        # Fit and transform
        transformed_data = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_transform, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {}
        
        # UMAP-specific metrics
        if hasattr(self.model, 'embedding_'):
            embedding_variance = np.var(transformed_data, axis=0)
            performance_metrics.update({
                'embedding_variance_x': float(embedding_variance[0]),
                'embedding_variance_y': float(embedding_variance[1]),
                'embedding_variance_z': float(embedding_variance[2]) if len(embedding_variance) > 2 else 0.0,
                'total_variance': float(np.sum(embedding_variance)),
                'n_neighbors_used': int(self.model.n_neighbors),
                'min_dist_used': float(self.model.min_dist),
            })
        
        # Ensure 3D output
        if transformed_data.shape[1] < 3:
            padding = np.zeros((transformed_data.shape[0], 3 - transformed_data.shape[1]))
            transformed_data = np.hstack([transformed_data, padding])
        
        return AlgorithmResult(
            data=transformed_data,
            metadata={
                'algorithm': 'UMAP',
                'n_components': transformed_data.shape[1],
                'n_samples': transformed_data.shape[0],
                'n_neighbors': self.model.n_neighbors,
                'min_dist': self.model.min_dist,
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class PCAReducer(MLAlgorithmBase):
    """
    Principal Component Analysis implementation.
    """
    
    def __init__(self, **params):
        """Initialize PCA reducer."""
        super().__init__(AlgorithmType.DIMENSIONALITY_REDUCTION, "PCA")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "PCAReducer":
        """Fit PCA model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_components': 3,
            'whiten': False,
            'random_state': 42,
        }
        params.update(self._params)
        params.update(kwargs)
        
        # Adjust components based on data dimensions
        max_components = min(params['n_components'], data.shape[1], data.shape[0])
        params['n_components'] = max_components
        
        self.model = PCA(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"PCA configured with {params['n_components']} components")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Transform data using PCA."""
        if not self.is_fitted or self.model is None:
            raise ValueError("PCA model not fitted")
        
        start_time = time.time()
        
        # Fit and transform
        self.model.fit(data)
        transformed_data = self.model.transform(data)
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        explained_variance_ratio = self.model.explained_variance_ratio_
        performance_metrics = {
            'explained_variance_ratio': explained_variance_ratio.tolist(),
            'total_explained_variance': float(np.sum(explained_variance_ratio)),
            'singular_values': self.model.singular_values_.tolist(),
        }
        
        # Individual component variances
        for i, var_ratio in enumerate(explained_variance_ratio):
            performance_metrics[f'pc{i+1}_variance_ratio'] = float(var_ratio)
        
        # Ensure 3D output
        if transformed_data.shape[1] < 3:
            padding = np.zeros((transformed_data.shape[0], 3 - transformed_data.shape[1]))
            transformed_data = np.hstack([transformed_data, padding])
        
        return AlgorithmResult(
            data=transformed_data,
            metadata={
                'algorithm': 'PCA',
                'n_components': self.model.n_components,
                'n_samples': transformed_data.shape[0],
                'n_features_original': data.shape[1],
                'whiten': self.model.whiten,
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )
    
    def get_feature_importance(self) -> Optional[np.ndarray]:
        """Get feature importance (component loadings)."""
        if self.model and hasattr(self.model, 'components_'):
            # Return absolute values of component loadings
            return np.abs(self.model.components_).mean(axis=0)
        return None


class KernelPCAReducer(MLAlgorithmBase):
    """
    Kernel PCA implementation for non-linear dimensionality reduction.
    """
    
    def __init__(self, **params):
        """Initialize Kernel PCA reducer."""
        super().__init__(AlgorithmType.DIMENSIONALITY_REDUCTION, "Kernel PCA")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "KernelPCAReducer":
        """Fit Kernel PCA model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_components': 3,
            'kernel': 'rbf',
            'gamma': None,
            'random_state': 42,
            'n_jobs': -1,
        }
        params.update(self._params)
        params.update(kwargs)
        
        # Adjust components based on data
        max_components = min(params['n_components'], data.shape[0])
        params['n_components'] = max_components
        
        # Auto-tune gamma for RBF kernel
        if params['kernel'] == 'rbf' and params['gamma'] is None:
            params['gamma'] = 1.0 / data.shape[1]
        
        self.model = KernelPCA(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"Kernel PCA configured with {params['kernel']} kernel")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Transform data using Kernel PCA."""
        if not self.is_fitted or self.model is None:
            raise ValueError("Kernel PCA model not fitted")
        
        start_time = time.time()
        
        # Fit and transform
        transformed_data = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_transform, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {}
        
        if hasattr(self.model, 'eigenvalues_'):
            eigenvalues = self.model.eigenvalues_
            total_eigenvalues = np.sum(eigenvalues)
            
            if total_eigenvalues > 0:
                explained_variance_ratio = eigenvalues / total_eigenvalues
                performance_metrics.update({
                    'eigenvalues': eigenvalues.tolist(),
                    'explained_variance_ratio': explained_variance_ratio.tolist(),
                    'total_explained_variance': float(np.sum(explained_variance_ratio)),
                })
        
        # Ensure 3D output
        if transformed_data.shape[1] < 3:
            padding = np.zeros((transformed_data.shape[0], 3 - transformed_data.shape[1]))
            transformed_data = np.hstack([transformed_data, padding])
        
        return AlgorithmResult(
            data=transformed_data,
            metadata={
                'algorithm': 'Kernel PCA',
                'n_components': self.model.n_components,
                'kernel': self.model.kernel,
                'n_samples': transformed_data.shape[0],
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class MDSReducer(MLAlgorithmBase):
    """
    Multidimensional Scaling implementation.
    """
    
    def __init__(self, **params):
        """Initialize MDS reducer."""
        super().__init__(AlgorithmType.DIMENSIONALITY_REDUCTION, "MDS")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "MDSReducer":
        """Fit MDS model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_components': 3,
            'metric': True,
            'dissimilarity': 'euclidean',
            'random_state': 42,
            'n_jobs': -1,
            'max_iter': 300,
        }
        params.update(self._params)
        params.update(kwargs)
        
        # Adjust parameters for large datasets
        n_samples = data.shape[0]
        if n_samples > 1000:
            params['max_iter'] = 150  # Reduce iterations for speed
        
        self.model = MDS(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"MDS configured for {n_samples} samples")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Transform data using MDS."""
        if not self.is_fitted or self.model is None:
            raise ValueError("MDS model not fitted")
        
        start_time = time.time()
        
        # Fit and transform
        transformed_data = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_transform, data
        )
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        performance_metrics = {}
        
        if hasattr(self.model, 'stress_'):
            performance_metrics['stress'] = float(self.model.stress_)
        
        if hasattr(self.model, 'dissimilarity_matrix_'):
            dissim_matrix = self.model.dissimilarity_matrix_
            performance_metrics['mean_dissimilarity'] = float(np.mean(dissim_matrix))
        
        # Ensure 3D output
        if transformed_data.shape[1] < 3:
            padding = np.zeros((transformed_data.shape[0], 3 - transformed_data.shape[1]))
            transformed_data = np.hstack([transformed_data, padding])
        
        return AlgorithmResult(
            data=transformed_data,
            metadata={
                'algorithm': 'MDS',
                'n_components': self.model.n_components,
                'metric': self.model.metric,
                'n_samples': transformed_data.shape[0],
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )