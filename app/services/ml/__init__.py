"""
Advanced Machine Learning services for production-ready ML processing.

This module provides a comprehensive suite of ML algorithms and utilities for:
- Dimensionality reduction (t-SNE, UMAP, PCA, Kernel PCA, MDS)
- Clustering (K-Means, DBSCAN, HDBSCAN, Agglomerative, Gaussian Mixture)
- Anomaly detection (Isolation Forest, One-Class SVM, Local Outlier Factor)
- Model optimization and hyperparameter tuning
- Performance validation and metrics
- Explainability and feature importance analysis
"""

from .processor import AdvancedMLProcessor
from .base import MLAlgorithmBase, ProcessingPipeline
from .dimensionality import (
    TSNEReducer,
    UMAPReducer,
    PCAReducer,
    KernelPCAReducer,
    MDSReducer,
)
from .clustering import (
    KMeansClusterer,
    DBSCANClusterer,
    HDBSCANClusterer,
    AgglomerativeClusterer,
    GaussianMixtureClusterer,
)
from .anomalies import (
    IsolationForestDetector,
    OneClassSVMDetector,
    LocalOutlierFactorDetector,
)
from .optimization import HyperparameterOptimizer
from .validation import ClusteringValidator
from .preprocessing import DataPreprocessor

__all__ = [
    "AdvancedMLProcessor",
    "MLAlgorithmBase",
    "ProcessingPipeline",
    "TSNEReducer",
    "UMAPReducer", 
    "PCAReducer",
    "KernelPCAReducer",
    "MDSReducer",
    "KMeansClusterer",
    "DBSCANClusterer",
    "HDBSCANClusterer",
    "AgglomerativeClusterer",
    "GaussianMixtureClusterer",
    "IsolationForestDetector",
    "OneClassSVMDetector",
    "LocalOutlierFactorDetector",
    "HyperparameterOptimizer",
    "ClusteringValidator",
    "DataPreprocessor",
]