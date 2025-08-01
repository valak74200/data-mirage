"""
Hyperparameter optimization and model selection for ML algorithms.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from sklearn.model_selection import ParameterGrid, ParameterSampler
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
import logging
from itertools import product
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed

from .base import ProcessingContext, AlgorithmResult
from .dimensionality import TSNEReducer, UMAPReducer, PCAReducer
from .clustering import KMeansClusterer, DBSCANClusterer, HDBSCANClusterer
from .anomalies import IsolationForestDetector

logger = logging.getLogger(__name__)


@dataclass
class OptimizationResult:
    """Result from hyperparameter optimization."""
    best_params: Dict[str, Any]
    best_score: float
    all_results: List[Dict[str, Any]]
    optimization_time: float
    n_trials: int
    optimization_method: str


class HyperparameterOptimizer:
    """
    Advanced hyperparameter optimizer for ML algorithms.
    
    Supports grid search, random search, and Bayesian optimization
    for dimensionality reduction, clustering, and anomaly detection.
    """
    
    def __init__(self, max_workers: int = 4):
        """
        Initialize hyperparameter optimizer.
        
        Args:
            max_workers: Maximum number of parallel workers
        """
        self.max_workers = max_workers
        self.parameter_spaces = self._define_parameter_spaces()
        
    def _define_parameter_spaces(self) -> Dict[str, Dict[str, List[Any]]]:
        """Define parameter spaces for different algorithms."""
        return {
            'tsne': {
                'perplexity': [5, 10, 15, 30, 50],
                'learning_rate': ['auto', 10, 50, 100, 200],
                'n_iter': [250, 500, 1000, 1500],
            },
            'umap': {
                'n_neighbors': [5, 10, 15, 20, 30, 50],
                'min_dist': [0.01, 0.05, 0.1, 0.3, 0.5],
                'metric': ['euclidean', 'manhattan', 'cosine'],
            },
            'pca': {
                'whiten': [True, False],
            },
            'kmeans': {
                'n_clusters': list(range(2, 11)),
                'init': ['k-means++', 'random'],
                'algorithm': ['lloyd', 'elkan'],
            },
            'dbscan': {
                'eps': [0.1, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0],
                'min_samples': [3, 5, 7, 10, 15],
                'metric': ['euclidean', 'manhattan', 'cosine'],
            },
            'hdbscan': {
                'min_cluster_size': [3, 5, 10, 15, 25],
                'cluster_selection_epsilon': [0.0, 0.1, 0.5],
                'alpha': [0.5, 1.0, 1.5],
            },
            'isolation_forest': {
                'n_estimators': [50, 100, 200],
                'contamination': [0.05, 0.1, 0.15, 0.2],
                'max_features': [0.5, 0.75, 1.0],
            },
        }
    
    async def optimize_clustering(
        self,
        data: np.ndarray,
        algorithm: str,
        context: ProcessingContext,
        method: str = 'grid_search',
        n_trials: int = 20,
        scoring: str = 'silhouette',
        custom_params: Optional[Dict[str, List[Any]]] = None,
    ) -> OptimizationResult:
        """
        Optimize clustering algorithm hyperparameters.
        
        Args:
            data: Input data
            algorithm: Clustering algorithm ('kmeans', 'dbscan', 'hdbscan')
            context: Processing context
            method: Optimization method ('grid_search', 'random_search')
            n_trials: Number of trials for random search
            scoring: Scoring metric ('silhouette', 'calinski_harabasz', 'davies_bouldin')
            custom_params: Custom parameter space
            
        Returns:
            Optimization results with best parameters
        """
        start_time = time.time()
        
        if algorithm not in ['kmeans', 'dbscan', 'hdbscan']:
            raise ValueError(f"Unsupported clustering algorithm: {algorithm}")
        
        # Get parameter space
        param_space = custom_params or self.parameter_spaces.get(algorithm, {})
        
        if not param_space:
            raise ValueError(f"No parameter space defined for {algorithm}")
        
        # Adjust parameter space based on data size
        param_space = self._adjust_param_space_for_data(param_space, data, algorithm)
        
        # Generate parameter combinations
        if method == 'grid_search':
            param_combinations = list(ParameterGrid(param_space))
        elif method == 'random_search':
            param_combinations = list(ParameterSampler(
                param_space, 
                n_iter=min(n_trials, np.prod([len(v) for v in param_space.values()])),
                random_state=42
            ))
        else:
            raise ValueError(f"Unsupported optimization method: {method}")
        
        logger.info(f"Starting {algorithm} optimization with {len(param_combinations)} combinations")
        
        # Evaluate parameter combinations
        results = await self._evaluate_clustering_params(
            data, algorithm, param_combinations, scoring, context
        )
        
        # Find best parameters
        best_result = max(results, key=lambda x: x['score'])
        
        optimization_time = time.time() - start_time
        
        return OptimizationResult(
            best_params=best_result['params'],
            best_score=best_result['score'],
            all_results=results,
            optimization_time=optimization_time,
            n_trials=len(param_combinations),
            optimization_method=method,
        )
    
    async def optimize_dimensionality_reduction(
        self,
        data: np.ndarray,
        algorithm: str,
        context: ProcessingContext,
        method: str = 'grid_search',
        n_trials: int = 15,
        scoring: str = 'embedding_quality',
        custom_params: Optional[Dict[str, List[Any]]] = None,
    ) -> OptimizationResult:
        """
        Optimize dimensionality reduction hyperparameters.
        
        Args:
            data: Input data
            algorithm: DR algorithm ('tsne', 'umap', 'pca')
            context: Processing context
            method: Optimization method
            n_trials: Number of trials
            scoring: Scoring metric
            custom_params: Custom parameter space
            
        Returns:
            Optimization results
        """
        start_time = time.time()
        
        if algorithm not in ['tsne', 'umap', 'pca']:
            raise ValueError(f"Unsupported dimensionality reduction algorithm: {algorithm}")
        
        # Get parameter space
        param_space = custom_params or self.parameter_spaces.get(algorithm, {})
        
        # Adjust for data size
        param_space = self._adjust_param_space_for_data(param_space, data, algorithm)
        
        # Generate combinations
        if method == 'grid_search':
            param_combinations = list(ParameterGrid(param_space))
        else:
            param_combinations = list(ParameterSampler(param_space, n_iter=n_trials, random_state=42))
        
        logger.info(f"Starting {algorithm} DR optimization with {len(param_combinations)} combinations")
        
        # Evaluate parameters
        results = await self._evaluate_dr_params(
            data, algorithm, param_combinations, scoring, context
        )
        
        best_result = max(results, key=lambda x: x['score'])
        
        optimization_time = time.time() - start_time
        
        return OptimizationResult(
            best_params=best_result['params'],
            best_score=best_result['score'],
            all_results=results,
            optimization_time=optimization_time,
            n_trials=len(param_combinations),
            optimization_method=method,
        )
    
    async def auto_select_best_algorithm(
        self,
        data: np.ndarray,
        context: ProcessingContext,
        task_type: str = 'clustering',
        algorithms: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Automatically select the best algorithm and parameters for a task.
        
        Args:
            data: Input data
            context: Processing context
            task_type: Type of task ('clustering', 'dimensionality_reduction', 'anomaly_detection')
            algorithms: List of algorithms to compare
            
        Returns:
            Best algorithm and parameters
        """
        start_time = time.time()
        
        if task_type == 'clustering':
            default_algorithms = ['kmeans', 'dbscan', 'hdbscan']
        elif task_type == 'dimensionality_reduction':
            default_algorithms = ['tsne', 'umap', 'pca']
        elif task_type == 'anomaly_detection':
            default_algorithms = ['isolation_forest']
        else:
            raise ValueError(f"Unsupported task type: {task_type}")
        
        algorithms = algorithms or default_algorithms
        
        # Optimize each algorithm
        algorithm_results = {}
        
        for algorithm in algorithms:
            try:
                if task_type == 'clustering':
                    result = await self.optimize_clustering(
                        data, algorithm, context, 
                        method='random_search', n_trials=10
                    )
                elif task_type == 'dimensionality_reduction':
                    result = await self.optimize_dimensionality_reduction(
                        data, algorithm, context,
                        method='random_search', n_trials=8
                    )
                
                algorithm_results[algorithm] = result
                
                logger.info(f"Optimized {algorithm}: score={result.best_score:.4f}")
                
            except Exception as e:
                logger.warning(f"Failed to optimize {algorithm}: {e}")
        
        if not algorithm_results:
            raise ValueError("No algorithms could be optimized")
        
        # Select best algorithm
        best_algorithm = max(algorithm_results.keys(), 
                           key=lambda alg: algorithm_results[alg].best_score)
        best_result = algorithm_results[best_algorithm]
        
        total_time = time.time() - start_time
        
        return {
            'best_algorithm': best_algorithm,
            'best_params': best_result.best_params,
            'best_score': best_result.best_score,
            'all_results': algorithm_results,
            'total_optimization_time': total_time,
            'recommendation_confidence': self._calculate_confidence(algorithm_results),
        }
    
    def _adjust_param_space_for_data(
        self, 
        param_space: Dict[str, List[Any]], 
        data: np.ndarray, 
        algorithm: str
    ) -> Dict[str, List[Any]]:
        """Adjust parameter space based on data characteristics."""
        n_samples, n_features = data.shape
        adjusted_space = param_space.copy()
        
        if algorithm == 'tsne':
            # Adjust perplexity for small datasets
            if 'perplexity' in adjusted_space:
                max_perplexity = (n_samples - 1) // 3
                adjusted_space['perplexity'] = [
                    p for p in adjusted_space['perplexity'] 
                    if p < max_perplexity
                ]
                if not adjusted_space['perplexity']:
                    adjusted_space['perplexity'] = [min(5, max_perplexity)]
        
        elif algorithm == 'umap':
            # Adjust n_neighbors for small datasets
            if 'n_neighbors' in adjusted_space:
                max_neighbors = n_samples - 1
                adjusted_space['n_neighbors'] = [
                    n for n in adjusted_space['n_neighbors']
                    if n < max_neighbors
                ]
        
        elif algorithm == 'kmeans':
            # Adjust n_clusters for small datasets
            if 'n_clusters' in adjusted_space:
                max_clusters = min(n_samples - 1, 10)
                adjusted_space['n_clusters'] = [
                    k for k in adjusted_space['n_clusters']
                    if k <= max_clusters
                ]
        
        elif algorithm == 'dbscan':
            # Adjust min_samples for small datasets
            if 'min_samples' in adjusted_space:
                max_min_samples = max(2, n_samples // 10)
                adjusted_space['min_samples'] = [
                    ms for ms in adjusted_space['min_samples']
                    if ms <= max_min_samples
                ]
        
        return adjusted_space
    
    async def _evaluate_clustering_params(
        self,
        data: np.ndarray,
        algorithm: str,
        param_combinations: List[Dict[str, Any]],
        scoring: str,
        context: ProcessingContext,
    ) -> List[Dict[str, Any]]:
        """Evaluate clustering parameter combinations."""
        results = []
        
        # Use ThreadPoolExecutor for CPU-bound tasks
        loop = asyncio.get_event_loop()
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tasks
            future_to_params = {
                loop.run_in_executor(
                    executor, 
                    self._evaluate_single_clustering_params,
                    data, algorithm, params, scoring
                ): params
                for params in param_combinations
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_params):
                params = future_to_params[future]
                try:
                    result = await future
                    result['params'] = params
                    results.append(result)
                except Exception as e:
                    logger.warning(f"Failed to evaluate params {params}: {e}")
                    results.append({
                        'params': params,
                        'score': -1.0,
                        'error': str(e),
                        'processing_time': 0.0,
                    })
        
        return results
    
    def _evaluate_single_clustering_params(
        self,
        data: np.ndarray,
        algorithm: str,
        params: Dict[str, Any],
        scoring: str,
    ) -> Dict[str, Any]:
        """Evaluate a single set of clustering parameters."""
        start_time = time.time()
        
        try:
            # Create and fit clusterer
            if algorithm == 'kmeans':
                clusterer = KMeansClusterer(**params)
            elif algorithm == 'dbscan':
                clusterer = DBSCANClusterer(**params)
            elif algorithm == 'hdbscan':
                clusterer = HDBSCANClusterer(**params)
            else:
                raise ValueError(f"Unknown algorithm: {algorithm}")
            
            # Fit synchronously (we're in a thread)
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            context = ProcessingContext()
            loop.run_until_complete(clusterer.fit(data, context))
            result = loop.run_until_complete(clusterer.transform(data, context))
            
            loop.close()
            
            # Calculate score
            cluster_labels = result.data
            score = self._calculate_clustering_score(data, cluster_labels, scoring)
            
            processing_time = time.time() - start_time
            
            return {
                'score': score,
                'processing_time': processing_time,
                'n_clusters': len(np.unique(cluster_labels)),
                'performance_metrics': result.performance_metrics,
            }
            
        except Exception as e:
            return {
                'score': -1.0,
                'error': str(e),
                'processing_time': time.time() - start_time,
            }
    
    async def _evaluate_dr_params(
        self,
        data: np.ndarray,
        algorithm: str,
        param_combinations: List[Dict[str, Any]],
        scoring: str,
        context: ProcessingContext,
    ) -> List[Dict[str, Any]]:
        """Evaluate dimensionality reduction parameter combinations."""
        results = []
        
        for params in param_combinations:
            try:
                start_time = time.time()
                
                # Create and fit reducer
                if algorithm == 'tsne':
                    reducer = TSNEReducer(**params)
                elif algorithm == 'umap':
                    reducer = UMAPReducer(**params)
                elif algorithm == 'pca':
                    reducer = PCAReducer(**params)
                else:
                    raise ValueError(f"Unknown algorithm: {algorithm}")
                
                await reducer.fit(data, context)
                result = await reducer.transform(data, context)
                
                # Calculate score
                score = self._calculate_dr_score(data, result.data, scoring, result.performance_metrics)
                
                processing_time = time.time() - start_time
                
                results.append({
                    'params': params,
                    'score': score,
                    'processing_time': processing_time,
                    'performance_metrics': result.performance_metrics,
                })
                
            except Exception as e:
                logger.warning(f"Failed to evaluate DR params {params}: {e}")
                results.append({
                    'params': params,
                    'score': -1.0,
                    'error': str(e),
                    'processing_time': 0.0,
                })
        
        return results
    
    def _calculate_clustering_score(
        self, 
        data: np.ndarray, 
        labels: np.ndarray, 
        scoring: str
    ) -> float:
        """Calculate clustering score."""
        unique_labels = np.unique(labels)
        
        # Handle noise points in DBSCAN/HDBSCAN
        if -1 in unique_labels:
            non_noise_mask = labels != -1
            if np.sum(non_noise_mask) < 2:
                return -1.0  # Not enough non-noise points
            
            data_clean = data[non_noise_mask]
            labels_clean = labels[non_noise_mask]
        else:
            data_clean = data
            labels_clean = labels
        
        if len(np.unique(labels_clean)) < 2:
            return -1.0  # Need at least 2 clusters
        
        try:
            if scoring == 'silhouette':
                return silhouette_score(data_clean, labels_clean)
            elif scoring == 'calinski_harabasz':
                return calinski_harabasz_score(data_clean, labels_clean)
            elif scoring == 'davies_bouldin':
                return -davies_bouldin_score(data_clean, labels_clean)  # Negative because lower is better
            else:
                return silhouette_score(data_clean, labels_clean)  # Default
        except Exception:
            return -1.0
    
    def _calculate_dr_score(
        self, 
        original_data: np.ndarray, 
        reduced_data: np.ndarray, 
        scoring: str,
        performance_metrics: Dict[str, Any]
    ) -> float:
        """Calculate dimensionality reduction score."""
        try:
            if scoring == 'embedding_quality':
                # Combined score based on variance and structure preservation
                variance_score = np.sum(np.var(reduced_data, axis=0))
                
                # Add algorithm-specific metrics
                if 'total_explained_variance' in performance_metrics:
                    explained_var = performance_metrics['total_explained_variance']
                    return float(explained_var * 0.7 + variance_score * 0.3)
                elif 'total_variance' in performance_metrics:
                    total_var = performance_metrics['total_variance']
                    return float(total_var)
                else:
                    return float(variance_score)
            
            elif scoring == 'explained_variance':
                return performance_metrics.get('total_explained_variance', 0.0)
            
            else:
                # Default: embedding variance
                return float(np.sum(np.var(reduced_data, axis=0)))
                
        except Exception:
            return 0.0
    
    def _calculate_confidence(self, algorithm_results: Dict[str, OptimizationResult]) -> float:
        """Calculate confidence in the best algorithm selection."""
        if len(algorithm_results) < 2:
            return 1.0
        
        scores = [result.best_score for result in algorithm_results.values()]
        best_score = max(scores)
        second_best_score = sorted(scores, reverse=True)[1]
        
        # Confidence based on score difference
        if second_best_score <= 0:
            return 1.0
        
        confidence = (best_score - second_best_score) / best_score
        return min(1.0, max(0.0, confidence))
    
    def get_optimization_recommendations(
        self, 
        data: np.ndarray,
        task_type: str = 'clustering'
    ) -> Dict[str, Any]:
        """Get optimization recommendations based on data characteristics."""
        n_samples, n_features = data.shape
        
        recommendations = {
            'data_characteristics': {
                'n_samples': n_samples,
                'n_features': n_features,
                'sample_to_feature_ratio': n_samples / n_features,
            }
        }
        
        # Sample size recommendations
        if n_samples < 100:
            recommendations['sample_size'] = 'small'
            recommendations['suggested_algorithms'] = {
                'clustering': ['kmeans', 'agglomerative'],
                'dimensionality_reduction': ['pca'],
                'anomaly_detection': ['elliptic_envelope']
            }
        elif n_samples < 1000:
            recommendations['sample_size'] = 'medium'
            recommendations['suggested_algorithms'] = {
                'clustering': ['kmeans', 'dbscan'],
                'dimensionality_reduction': ['tsne', 'pca'],
                'anomaly_detection': ['isolation_forest', 'local_outlier_factor']
            }
        else:
            recommendations['sample_size'] = 'large'
            recommendations['suggested_algorithms'] = {
                'clustering': ['kmeans', 'dbscan', 'hdbscan'],
                'dimensionality_reduction': ['umap', 'tsne'],
                'anomaly_detection': ['isolation_forest']
            }
        
        # Feature dimensionality recommendations
        if n_features > 50:
            recommendations['dimensionality'] = 'high'
            recommendations['preprocessing'] = ['feature_selection', 'pca_preprocessing']
        else:
            recommendations['dimensionality'] = 'moderate'
            recommendations['preprocessing'] = ['standard_scaling']
        
        # Optimization strategy recommendations
        if n_samples * len(recommendations['suggested_algorithms'].get(task_type, [])) > 10000:
            recommendations['optimization_strategy'] = 'random_search'
            recommendations['n_trials'] = 20
        else:
            recommendations['optimization_strategy'] = 'grid_search'
            recommendations['n_trials'] = None
        
        return recommendations