"""
Base classes and interfaces for ML algorithms.
"""

import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class AlgorithmType(str, Enum):
    """Types of ML algorithms."""
    DIMENSIONALITY_REDUCTION = "dimensionality_reduction"
    CLUSTERING = "clustering"
    ANOMALY_DETECTION = "anomaly_detection"


class ProcessingStage(str, Enum):
    """Processing pipeline stages."""
    PREPROCESSING = "preprocessing"
    DIMENSIONALITY_REDUCTION = "dimensionality_reduction"
    CLUSTERING = "clustering"
    ANOMALY_DETECTION = "anomaly_detection"
    VALIDATION = "validation"
    OPTIMIZATION = "optimization"
    FINALIZATION = "finalization"


@dataclass
class AlgorithmResult:
    """Result from an ML algorithm."""
    data: np.ndarray
    metadata: Dict[str, Any]
    performance_metrics: Dict[str, float]
    processing_time: float
    algorithm_params: Dict[str, Any]


@dataclass
class ProcessingContext:
    """Context for ML processing operations."""
    dataset_id: Optional[str] = None
    user_id: Optional[str] = None
    stage: ProcessingStage = ProcessingStage.PREPROCESSING
    progress: float = 0.0
    start_time: float = 0.0
    intermediate_results: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.intermediate_results is None:
            self.intermediate_results = {}
        if self.start_time == 0.0:
            self.start_time = time.time()


class MLAlgorithmBase(ABC):
    """
    Base class for all ML algorithms.
    
    Provides common interface and functionality for dimensionality reduction,
    clustering, and anomaly detection algorithms.
    """
    
    def __init__(self, algorithm_type: AlgorithmType, name: str):
        """
        Initialize base ML algorithm.
        
        Args:
            algorithm_type: Type of algorithm
            name: Algorithm name
        """
        self.algorithm_type = algorithm_type
        self.name = name
        self.is_fitted = False
        self.fit_time = 0.0
        self.performance_metrics = {}
        
    @abstractmethod
    async def fit(
        self, 
        data: np.ndarray, 
        context: ProcessingContext,
        **kwargs
    ) -> "MLAlgorithmBase":
        """
        Fit the algorithm to data.
        
        Args:
            data: Input data
            context: Processing context
            **kwargs: Algorithm-specific parameters
            
        Returns:
            Self for method chaining
        """
        pass
    
    @abstractmethod
    async def transform(
        self, 
        data: Optional[np.ndarray] = None,
        context: Optional[ProcessingContext] = None
    ) -> AlgorithmResult:
        """
        Transform data using fitted algorithm.
        
        Args:
            data: Data to transform (None to use fit data)
            context: Processing context
            
        Returns:
            Algorithm result with transformed data
        """
        pass
    
    async def fit_transform(
        self, 
        data: np.ndarray,
        context: ProcessingContext,
        **kwargs
    ) -> AlgorithmResult:
        """
        Fit algorithm and transform data in one step.
        
        Args:
            data: Input data
            context: Processing context
            **kwargs: Algorithm-specific parameters
            
        Returns:
            Algorithm result with transformed data
        """
        await self.fit(data, context, **kwargs)
        return await self.transform(data, context)
    
    def get_params(self) -> Dict[str, Any]:
        """Get algorithm parameters."""
        return getattr(self, '_params', {})
    
    def set_params(self, **params) -> "MLAlgorithmBase":
        """Set algorithm parameters."""
        self._params = {**getattr(self, '_params', {}), **params}
        return self
    
    def get_feature_importance(self) -> Optional[np.ndarray]:
        """Get feature importance if available."""
        return None
    
    def get_validation_score(self, data: np.ndarray, labels: np.ndarray) -> float:
        """Get validation score for the algorithm."""
        return 0.0


class ProcessingPipeline:
    """
    ML processing pipeline for chaining algorithms.
    
    Manages the complete ML workflow including preprocessing,
    dimensionality reduction, clustering, and anomaly detection.
    """
    
    def __init__(self, context: ProcessingContext):
        """
        Initialize processing pipeline.
        
        Args:
            context: Processing context
        """
        self.context = context
        self.algorithms: Dict[ProcessingStage, MLAlgorithmBase] = {}
        self.results: Dict[ProcessingStage, AlgorithmResult] = {}
        self.progress_callbacks: List[callable] = []
    
    def add_algorithm(
        self, 
        stage: ProcessingStage, 
        algorithm: MLAlgorithmBase
    ) -> "ProcessingPipeline":
        """
        Add algorithm to pipeline stage.
        
        Args:
            stage: Processing stage
            algorithm: ML algorithm
            
        Returns:
            Self for method chaining
        """
        self.algorithms[stage] = algorithm
        return self
    
    def add_progress_callback(self, callback: callable) -> "ProcessingPipeline":
        """
        Add progress callback function.
        
        Args:
            callback: Function to call on progress updates
            
        Returns:
            Self for method chaining
        """
        self.progress_callbacks.append(callback)
        return self
    
    async def _update_progress(self, stage: ProcessingStage, progress: float, message: str):
        """Update processing progress."""
        self.context.stage = stage
        self.context.progress = progress
        
        for callback in self.progress_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self.context, stage.value, progress, message)
                else:
                    callback(self.context, stage.value, progress, message)
            except Exception as e:
                logger.warning(f"Progress callback failed: {e}")
    
    async def run(
        self, 
        data: np.ndarray,
        stages: Optional[List[ProcessingStage]] = None
    ) -> Dict[ProcessingStage, AlgorithmResult]:
        """
        Run processing pipeline.
        
        Args:
            data: Input data
            stages: Specific stages to run (None for all)
            
        Returns:
            Results for each stage
        """
        if stages is None:
            stages = list(self.algorithms.keys())
        
        current_data = data
        total_stages = len(stages)
        
        for i, stage in enumerate(stages):
            if stage not in self.algorithms:
                logger.warning(f"No algorithm defined for stage: {stage}")
                continue
            
            stage_progress = (i / total_stages) * 100
            await self._update_progress(
                stage, 
                stage_progress, 
                f"Running {stage.value}..."
            )
            
            algorithm = self.algorithms[stage]
            
            try:
                # Run algorithm
                result = await algorithm.fit_transform(current_data, self.context)
                self.results[stage] = result
                
                # Update data for next stage
                if stage in [ProcessingStage.DIMENSIONALITY_REDUCTION]:
                    current_data = result.data
                
                # Store intermediate results
                self.context.intermediate_results[stage.value] = result
                
                logger.info(
                    f"Completed {stage.value} in {result.processing_time:.2f}s"
                )
                
            except Exception as e:
                logger.error(f"Failed at stage {stage.value}: {e}")
                raise
        
        # Final progress update
        await self._update_progress(
            ProcessingStage.FINALIZATION, 
            100.0, 
            "Processing completed"
        )
        
        return self.results
    
    def get_final_result(self) -> Optional[AlgorithmResult]:
        """Get final processing result."""
        if not self.results:
            return None
        
        # Return the last result
        last_stage = list(self.results.keys())[-1]
        return self.results[last_stage]
    
    def get_processing_summary(self) -> Dict[str, Any]:
        """Get processing pipeline summary."""
        total_time = time.time() - self.context.start_time
        
        return {
            "total_processing_time": total_time,
            "stages_completed": len(self.results),
            "algorithms_used": {
                stage.value: algo.name 
                for stage, algo in self.algorithms.items()
            },
            "performance_metrics": {
                stage.value: result.performance_metrics
                for stage, result in self.results.items()
            }
        }


class AsyncMLProcessor:
    """
    Asynchronous ML processor for handling large datasets.
    
    Provides background processing, progress tracking, and resource management
    for computationally intensive ML operations.
    """
    
    def __init__(self, max_concurrent_tasks: int = 3):
        """
        Initialize async ML processor.
        
        Args:
            max_concurrent_tasks: Maximum concurrent processing tasks
        """
        self.max_concurrent_tasks = max_concurrent_tasks
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.task_results: Dict[str, Any] = {}
        self.task_semaphore = asyncio.Semaphore(max_concurrent_tasks)
    
    async def submit_task(
        self, 
        task_id: str,
        pipeline: ProcessingPipeline,
        data: np.ndarray
    ) -> str:
        """
        Submit processing task for background execution.
        
        Args:
            task_id: Unique task identifier
            pipeline: Processing pipeline
            data: Input data
            
        Returns:
            Task ID
        """
        if task_id in self.active_tasks:
            raise ValueError(f"Task {task_id} already exists")
        
        async def _run_task():
            async with self.task_semaphore:
                try:
                    results = await pipeline.run(data)
                    self.task_results[task_id] = {
                        "status": "completed",
                        "results": results,
                        "summary": pipeline.get_processing_summary()
                    }
                except Exception as e:
                    self.task_results[task_id] = {
                        "status": "failed",
                        "error": str(e),
                        "summary": pipeline.get_processing_summary()
                    }
                finally:
                    # Clean up active task
                    if task_id in self.active_tasks:
                        del self.active_tasks[task_id]
        
        task = asyncio.create_task(_run_task())
        self.active_tasks[task_id] = task
        
        return task_id
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get status of processing task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            Task status information
        """
        if task_id in self.active_tasks:
            return {
                "status": "running",
                "task_id": task_id,
                "is_done": self.active_tasks[task_id].done()
            }
        elif task_id in self.task_results:
            return self.task_results[task_id]
        else:
            return {"status": "not_found", "task_id": task_id}
    
    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel processing task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            True if task was cancelled
        """
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            task.cancel()
            del self.active_tasks[task_id]
            
            self.task_results[task_id] = {
                "status": "cancelled",
                "task_id": task_id
            }
            return True
        
        return False
    
    async def cleanup_completed_tasks(self, max_age_seconds: int = 3600):
        """
        Clean up old completed task results.
        
        Args:
            max_age_seconds: Maximum age for keeping results
        """
        current_time = time.time()
        to_remove = []
        
        for task_id, result in self.task_results.items():
            if result.get("status") in ["completed", "failed", "cancelled"]:
                # Check if result is old (implementation depends on adding timestamp)
                to_remove.append(task_id)
        
        # For now, just remove all completed tasks
        # In production, you'd want to add timestamps and proper cleanup logic
        for task_id in to_remove[:10]:  # Keep only last 10 results
            del self.task_results[task_id]