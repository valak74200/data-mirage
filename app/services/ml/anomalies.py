"""
Advanced anomaly detection algorithms.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Union
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.neighbors import LocalOutlierFactor
from sklearn.covariance import EllipticEnvelope
from sklearn.preprocessing import StandardScaler
import logging

try:
    from sklearn.ensemble import IsolationForest
    from pyod.models.knn import KNN
    from pyod.models.lof import LOF
    from pyod.models.cblof import CBLOF
    HAS_PYOD = True
except ImportError:
    HAS_PYOD = False

from .base import MLAlgorithmBase, AlgorithmType, ProcessingContext, AlgorithmResult

logger = logging.getLogger(__name__)


class IsolationForestDetector(MLAlgorithmBase):
    """
    Isolation Forest anomaly detection with parameter optimization.
    """
    
    def __init__(self, **params):
        """Initialize Isolation Forest detector."""
        super().__init__(AlgorithmType.ANOMALY_DETECTION, "Isolation Forest")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "IsolationForestDetector":
        """Fit Isolation Forest model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_estimators': 100,
            'contamination': 0.1,
            'max_samples': 'auto',
            'max_features': 1.0,
            'bootstrap': False,
            'random_state': 42,
            'n_jobs': -1,
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Optimize parameters based on data size
        if n_samples > 10000:
            params['n_estimators'] = 50  # Reduce for speed
            params['max_samples'] = min(256, n_samples)
        elif n_samples < 100:
            params['n_estimators'] = 200  # Increase for stability
            params['contamination'] = max(0.05, params['contamination'])
        
        # Auto-tune contamination if requested
        if params.get('auto_contamination', False):
            params['contamination'] = await self._estimate_contamination(data)
        
        self.model = IsolationForest(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"Isolation Forest configured with contamination={params['contamination']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Detect anomalies using Isolation Forest."""
        if not self.is_fitted or self.model is None:
            raise ValueError("Isolation Forest model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        anomaly_labels = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_predict, data
        )
        
        # Get anomaly scores
        anomaly_scores = self.model.decision_function(data)
        
        processing_time = time.time() - start_time
        
        # Convert labels (-1 for anomaly, 1 for normal) to boolean mask
        anomaly_mask = anomaly_labels == -1
        anomaly_indices = np.where(anomaly_mask)[0]
        
        # Calculate performance metrics
        n_anomalies = np.sum(anomaly_mask)
        anomaly_ratio = n_anomalies / len(data)
        
        performance_metrics = {
            'n_anomalies_detected': int(n_anomalies),
            'anomaly_ratio': float(anomaly_ratio),
            'mean_anomaly_score': float(np.mean(anomaly_scores[anomaly_mask])) if n_anomalies > 0 else 0.0,
            'mean_normal_score': float(np.mean(anomaly_scores[~anomaly_mask])) if np.sum(~anomaly_mask) > 0 else 0.0,
            'score_threshold': float(np.percentile(anomaly_scores, (1 - self.model.contamination) * 100)),
            'min_anomaly_score': float(np.min(anomaly_scores)),
            'max_anomaly_score': float(np.max(anomaly_scores)),
        }
        
        return AlgorithmResult(
            data=anomaly_indices,
            metadata={
                'algorithm': 'Isolation Forest',
                'contamination': self.model.contamination,
                'n_estimators': self.model.n_estimators,
                'n_samples': len(data),
                'anomaly_scores': anomaly_scores.tolist(),
                'anomaly_labels': anomaly_labels.tolist(),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )
    
    async def _estimate_contamination(self, data: np.ndarray) -> float:
        """Estimate optimal contamination rate using statistical methods."""
        # Use IQR method to estimate outlier percentage
        Q1 = np.percentile(data, 25, axis=0)
        Q3 = np.percentile(data, 75, axis=0)
        IQR = Q3 - Q1
        
        # Points outside 1.5 * IQR are potential outliers
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        outlier_mask = np.any((data < lower_bound) | (data > upper_bound), axis=1)
        estimated_contamination = np.sum(outlier_mask) / len(data)
        
        # Clamp to reasonable range
        estimated_contamination = max(0.01, min(0.3, estimated_contamination))
        
        logger.info(f"Estimated contamination rate: {estimated_contamination:.3f}")
        return estimated_contamination


class OneClassSVMDetector(MLAlgorithmBase):
    """
    One-Class SVM anomaly detection.
    """
    
    def __init__(self, **params):
        """Initialize One-Class SVM detector."""
        super().__init__(AlgorithmType.ANOMALY_DETECTION, "One-Class SVM")
        self.set_params(**params)
        self.model = None
        self.scaler = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "OneClassSVMDetector":
        """Fit One-Class SVM model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'kernel': 'rbf',
            'gamma': 'scale',
            'nu': 0.1,  # Similar to contamination in Isolation Forest
            'degree': 3,
            'coef0': 0.0,
            'shrinking': True,
            'cache_size': 200,
            'max_iter': -1,
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Adjust parameters based on data size
        if n_samples > 5000:
            params['cache_size'] = 1000  # Increase cache for large datasets
        elif n_samples < 100:
            params['nu'] = max(0.05, params['nu'])  # More conservative for small datasets
        
        # Scale data for SVM
        self.scaler = StandardScaler()
        scaled_data = self.scaler.fit_transform(data)
        
        self.model = OneClassSVM(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"One-Class SVM configured with nu={params['nu']}, kernel={params['kernel']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Detect anomalies using One-Class SVM."""
        if not self.is_fitted or self.model is None:
            raise ValueError("One-Class SVM model not fitted")
        
        start_time = time.time()
        
        # Scale data
        scaled_data = self.scaler.transform(data)
        
        # Fit and predict
        self.model.fit(scaled_data)
        anomaly_labels = self.model.predict(scaled_data)
        
        # Get decision scores
        decision_scores = self.model.decision_function(scaled_data)
        
        processing_time = time.time() - start_time
        
        # Convert labels (-1 for anomaly, 1 for normal) to boolean mask
        anomaly_mask = anomaly_labels == -1
        anomaly_indices = np.where(anomaly_mask)[0]
        
        # Calculate performance metrics
        n_anomalies = np.sum(anomaly_mask)
        anomaly_ratio = n_anomalies / len(data)
        
        performance_metrics = {
            'n_anomalies_detected': int(n_anomalies),
            'anomaly_ratio': float(anomaly_ratio),
            'mean_decision_score': float(np.mean(decision_scores)),
            'std_decision_score': float(np.std(decision_scores)),
            'min_decision_score': float(np.min(decision_scores)),
            'max_decision_score': float(np.max(decision_scores)),
            'n_support_vectors': int(len(self.model.support_vectors_)),
        }
        
        return AlgorithmResult(
            data=anomaly_indices,
            metadata={
                'algorithm': 'One-Class SVM',
                'nu': self.model.nu,
                'kernel': self.model.kernel,
                'n_samples': len(data),
                'decision_scores': decision_scores.tolist(),
                'anomaly_labels': anomaly_labels.tolist(),
                'support_vectors': self.model.support_vectors_.tolist(),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class LocalOutlierFactorDetector(MLAlgorithmBase):
    """
    Local Outlier Factor anomaly detection.
    """
    
    def __init__(self, **params):
        """Initialize LOF detector."""
        super().__init__(AlgorithmType.ANOMALY_DETECTION, "Local Outlier Factor")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "LocalOutlierFactorDetector":
        """Fit LOF model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'n_neighbors': 20,
            'algorithm': 'auto',
            'leaf_size': 30,
            'metric': 'minkowski',
            'p': 2,
            'contamination': 0.1,
            'novelty': False,  # For fitting on the same data
            'n_jobs': -1,
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Adjust n_neighbors based on data size
        max_neighbors = min(params['n_neighbors'], n_samples - 1)
        params['n_neighbors'] = max(2, max_neighbors)
        
        # Optimize for large datasets
        if n_samples > 10000:
            params['algorithm'] = 'kd_tree'
        
        self.model = LocalOutlierFactor(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"LOF configured with n_neighbors={params['n_neighbors']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Detect anomalies using LOF."""
        if not self.is_fitted or self.model is None:
            raise ValueError("LOF model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        anomaly_labels = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_predict, data
        )
        
        # Get LOF scores
        lof_scores = -self.model.negative_outlier_factor_  # Convert to positive
        
        processing_time = time.time() - start_time
        
        # Convert labels (-1 for anomaly, 1 for normal) to boolean mask
        anomaly_mask = anomaly_labels == -1
        anomaly_indices = np.where(anomaly_mask)[0]
        
        # Calculate performance metrics
        n_anomalies = np.sum(anomaly_mask)
        anomaly_ratio = n_anomalies / len(data)
        
        performance_metrics = {
            'n_anomalies_detected': int(n_anomalies),
            'anomaly_ratio': float(anomaly_ratio),
            'mean_lof_score': float(np.mean(lof_scores)),
            'std_lof_score': float(np.std(lof_scores)),
            'mean_anomaly_lof_score': float(np.mean(lof_scores[anomaly_mask])) if n_anomalies > 0 else 0.0,
            'mean_normal_lof_score': float(np.mean(lof_scores[~anomaly_mask])) if np.sum(~anomaly_mask) > 0 else 0.0,
            'max_lof_score': float(np.max(lof_scores)),
            'lof_threshold': float(np.percentile(lof_scores, (1 - self.model.contamination) * 100)),
        }
        
        return AlgorithmResult(
            data=anomaly_indices,
            metadata={
                'algorithm': 'Local Outlier Factor',
                'n_neighbors': self.model.n_neighbors,
                'contamination': self.model.contamination,
                'n_samples': len(data),
                'lof_scores': lof_scores.tolist(),
                'anomaly_labels': anomaly_labels.tolist(),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class EllipticEnvelopeDetector(MLAlgorithmBase):
    """
    Elliptic Envelope anomaly detection (assumes Gaussian distribution).
    """
    
    def __init__(self, **params):
        """Initialize Elliptic Envelope detector."""
        super().__init__(AlgorithmType.ANOMALY_DETECTION, "Elliptic Envelope")
        self.set_params(**params)
        self.model = None
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "EllipticEnvelopeDetector":
        """Fit Elliptic Envelope model."""
        start_time = time.time()
        
        # Default parameters
        params = {
            'contamination': 0.1,
            'support_fraction': None,
            'random_state': 42,
        }
        params.update(self._params)
        params.update(kwargs)
        
        n_samples = data.shape[0]
        
        # Adjust support_fraction for small datasets
        if n_samples < 100:
            params['support_fraction'] = 0.8
        
        self.model = EllipticEnvelope(**params)
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"Elliptic Envelope configured with contamination={params['contamination']}")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Detect anomalies using Elliptic Envelope."""
        if not self.is_fitted or self.model is None:
            raise ValueError("Elliptic Envelope model not fitted")
        
        start_time = time.time()
        
        # Fit and predict
        anomaly_labels = await asyncio.get_event_loop().run_in_executor(
            None, self.model.fit_predict, data
        )
        
        # Get decision scores
        decision_scores = self.model.decision_function(data)
        
        processing_time = time.time() - start_time
        
        # Convert labels (-1 for anomaly, 1 for normal) to boolean mask
        anomaly_mask = anomaly_labels == -1
        anomaly_indices = np.where(anomaly_mask)[0]
        
        # Calculate performance metrics
        n_anomalies = np.sum(anomaly_mask)
        anomaly_ratio = n_anomalies / len(data)
        
        performance_metrics = {
            'n_anomalies_detected': int(n_anomalies),
            'anomaly_ratio': float(anomaly_ratio),
            'mean_decision_score': float(np.mean(decision_scores)),
            'std_decision_score': float(np.std(decision_scores)),
            'mahalanobis_threshold': float(np.percentile(decision_scores, (1 - self.model.contamination) * 100)),
        }
        
        # Covariance matrix properties
        if hasattr(self.model, 'covariance_'):
            cov_det = np.linalg.det(self.model.covariance_)
            performance_metrics['covariance_determinant'] = float(cov_det)
        
        return AlgorithmResult(
            data=anomaly_indices,
            metadata={
                'algorithm': 'Elliptic Envelope',
                'contamination': self.model.contamination,
                'n_samples': len(data),
                'decision_scores': decision_scores.tolist(),
                'anomaly_labels': anomaly_labels.tolist(),
                'location': self.model.location_.tolist(),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )


class EnsembleAnomalyDetector(MLAlgorithmBase):
    """
    Ensemble anomaly detector combining multiple algorithms.
    """
    
    def __init__(self, **params):
        """Initialize ensemble anomaly detector."""
        super().__init__(AlgorithmType.ANOMALY_DETECTION, "Ensemble Anomaly Detector")
        self.set_params(**params)
        self.detectors = []
        self.detector_weights = []
        
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "EnsembleAnomalyDetector":
        """Fit ensemble of anomaly detectors."""
        start_time = time.time()
        
        # Default detector configurations
        detector_configs = [
            (IsolationForestDetector, {'contamination': 0.1, 'n_estimators': 50}),
            (LocalOutlierFactorDetector, {'contamination': 0.1, 'n_neighbors': 20}),
            (OneClassSVMDetector, {'nu': 0.1, 'kernel': 'rbf'}),
        ]
        
        # Override with custom configurations
        if 'detector_configs' in kwargs:
            detector_configs = kwargs['detector_configs']
        
        # Fit each detector
        for detector_class, config in detector_configs:
            try:
                detector = detector_class(**config)
                await detector.fit(data, context)
                self.detectors.append(detector)
                self.detector_weights.append(1.0)  # Equal weights by default
                
                logger.info(f"Fitted {detector.name} for ensemble")
                
            except Exception as e:
                logger.warning(f"Failed to fit {detector_class.__name__}: {e}")
        
        if not self.detectors:
            raise ValueError("No detectors could be fitted for ensemble")
        
        # Normalize weights
        total_weight = sum(self.detector_weights)
        self.detector_weights = [w / total_weight for w in self.detector_weights]
        
        self.is_fitted = True
        self.fit_time = time.time() - start_time
        
        logger.info(f"Ensemble anomaly detector fitted with {len(self.detectors)} detectors")
        
        return self
    
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """Detect anomalies using ensemble voting."""
        if not self.is_fitted or not self.detectors:
            raise ValueError("Ensemble anomaly detector not fitted")
        
        start_time = time.time()
        
        # Get predictions from all detectors
        all_predictions = []
        all_scores = []
        detector_results = []
        
        for detector, weight in zip(self.detectors, self.detector_weights):
            try:
                result = await detector.transform(data, context)
                
                # Convert indices to binary mask
                anomaly_mask = np.zeros(len(data), dtype=bool)
                anomaly_mask[result.data] = True
                all_predictions.append(anomaly_mask.astype(int))
                
                # Get scores if available
                if 'decision_scores' in result.metadata:
                    scores = np.array(result.metadata['decision_scores'])
                    # Normalize scores to [0, 1]
                    scores = (scores - np.min(scores)) / (np.max(scores) - np.min(scores) + 1e-8)
                    all_scores.append(scores * weight)
                elif 'anomaly_scores' in result.metadata:
                    scores = np.array(result.metadata['anomaly_scores'])
                    scores = (scores - np.min(scores)) / (np.max(scores) - np.min(scores) + 1e-8)
                    all_scores.append(scores * weight)
                else:
                    all_scores.append(anomaly_mask.astype(float) * weight)
                
                detector_results.append({
                    'detector': detector.name,
                    'n_anomalies': int(np.sum(anomaly_mask)),
                    'weight': weight,
                })
                
            except Exception as e:
                logger.warning(f"Detector {detector.name} failed during prediction: {e}")
        
        if not all_predictions:
            raise ValueError("All detectors failed during prediction")
        
        # Ensemble voting
        vote_threshold = self.get_params().get('vote_threshold', 0.5)
        
        # Weighted voting based on anomaly scores
        ensemble_scores = np.sum(all_scores, axis=0)
        score_threshold = np.percentile(ensemble_scores, (1 - 0.1) * 100)  # Default 10% contamination
        
        # Binary voting
        ensemble_votes = np.sum(all_predictions, axis=0)
        vote_anomalies = ensemble_votes >= (len(self.detectors) * vote_threshold)
        
        # Score-based anomalies
        score_anomalies = ensemble_scores >= score_threshold
        
        # Combine both methods
        final_anomalies = vote_anomalies | score_anomalies
        anomaly_indices = np.where(final_anomalies)[0]
        
        processing_time = time.time() - start_time
        
        # Calculate performance metrics
        n_anomalies = len(anomaly_indices)
        anomaly_ratio = n_anomalies / len(data)
        
        performance_metrics = {
            'n_anomalies_detected': n_anomalies,
            'anomaly_ratio': float(anomaly_ratio),
            'n_detectors_used': len(self.detectors),
            'mean_ensemble_score': float(np.mean(ensemble_scores)),
            'std_ensemble_score': float(np.std(ensemble_scores)),
            'score_threshold': float(score_threshold),
            'vote_threshold': vote_threshold,
            'detector_agreement': float(np.mean(ensemble_votes / len(self.detectors))),
        }
        
        return AlgorithmResult(
            data=anomaly_indices,
            metadata={
                'algorithm': 'Ensemble Anomaly Detector',
                'n_detectors': len(self.detectors),
                'detector_results': detector_results,
                'ensemble_scores': ensemble_scores.tolist(),
                'ensemble_votes': ensemble_votes.tolist(),
                'vote_anomalies': np.where(vote_anomalies)[0].tolist(),
                'score_anomalies': np.where(score_anomalies)[0].tolist(),
            },
            performance_metrics=performance_metrics,
            processing_time=processing_time,
            algorithm_params=self.get_params(),
        )