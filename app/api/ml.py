"""
Machine Learning API routes for data processing and analysis.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis

from core.deps import (
    get_async_session,
    get_current_active_user,
    get_ml_processor,
    get_rag_service,
    get_websocket_manager,
    get_redis,
)
from models.user import User
from models.dataset import Dataset
from schemas.ml import (
    ProcessingRequest,
    ProcessingResult,
    ProcessingProgress,
    MLConfig,
)
from services.ml_processor import MLProcessor, MLProcessingError
from services.rag_service import RAGService
from services.websocket import WebSocketManager

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.post(
    "/process/{dataset_id}",
    response_model=ProcessingResult,
    summary="Process dataset",
    description="Process dataset with ML algorithms for 3D visualization."
)
async def process_dataset(
    dataset_id: str,
    config: MLConfig,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
    ml_processor: MLProcessor = Depends(get_ml_processor),
    rag_service: RAGService = Depends(get_rag_service),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
):
    """
    Process dataset with machine learning algorithms for 3D visualization.
    
    - **dataset_id**: ID of dataset to process
    - **config**: ML processing configuration including:
      - **reduction_method**: t-SNE, UMAP, or PCA
      - **clustering_method**: K-Means, DBSCAN, HDBSCAN, or Agglomerative
      - **detect_anomalies**: Whether to detect anomalies
      - Algorithm-specific configurations
    
    Returns 3D coordinates, clusters, and AI-generated explanations.
    Processing updates are sent via WebSocket in real-time.
    """
    try:
        # Get dataset
        stmt = select(Dataset).where(Dataset.id == dataset_id)
        result = await session.execute(stmt)
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        # Check access permissions
        if dataset.user_id != current_user.id and not dataset.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You don't have permission to process this dataset."
            )
        
        # Check if dataset has data
        if not dataset.original_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset has no data to process"
            )
        
        # Update dataset status
        dataset.set_processing()
        dataset.processing_config = config.model_dump()
        await session.commit()
        
        # Notify WebSocket clients about processing start
        await websocket_manager.notify_processing_started(
            dataset_id=dataset_id,
            config=config.model_dump(),
            user_id=current_user.id,
        )
        
        # Process dataset
        processing_result = await ml_processor.process_dataset(
            data=dataset.original_data,
            config=config,
            dataset_id=dataset_id,
        )
        
        # Generate AI explanations
        try:
            explanations = await rag_service.explain_clusters(
                processing_result=processing_result,
                dataset_metadata=dataset.metadata,
                language="fr",  # TODO: Get from user preferences
            )
            processing_result.explanations = explanations
            
            # Notify WebSocket clients about RAG completion
            await websocket_manager.notify_rag_completed(
                dataset_id=dataset_id,
                explanations=[exp.model_dump() for exp in explanations],
                user_id=current_user.id,
            )
            
        except Exception as e:
            # Continue without explanations if RAG fails
            processing_result.explanations = []
            print(f"RAG explanation failed: {e}")
        
        # Update dataset with results
        dataset.set_processed(processing_result.model_dump())
        await session.commit()
        
        # Notify WebSocket clients about completion
        await websocket_manager.notify_processing_completed(
            dataset_id=dataset_id,
            result=processing_result.model_dump(),
            user_id=current_user.id,
        )
        
        return processing_result
        
    except HTTPException:
        # Update dataset status on HTTP errors
        if 'dataset' in locals():
            dataset.set_error("Processing failed due to client error")
            await session.commit()
        raise
        
    except MLProcessingError as e:
        # Update dataset status on ML errors
        dataset.set_error(str(e))
        await session.commit()
        
        # Notify WebSocket clients about error
        await websocket_manager.notify_processing_error(
            dataset_id=dataset_id,
            error=str(e),
            user_id=current_user.id,
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
        
    except Exception as e:
        # Update dataset status on general errors
        if 'dataset' in locals():
            dataset.set_error(f"Unexpected error: {str(e)}")
            await session.commit()
        
        # Notify WebSocket clients about error
        await websocket_manager.notify_processing_error(
            dataset_id=dataset_id,
            error=f"Processing failed: {str(e)}",
            user_id=current_user.id,
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Processing failed due to internal error"
        )


@router.get(
    "/progress/{dataset_id}",
    response_model=Optional[ProcessingProgress],
    summary="Get processing progress",
    description="Get current processing progress for a dataset."
)
async def get_processing_progress(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
    ml_processor: MLProcessor = Depends(get_ml_processor),
):
    """
    Get current processing progress for a dataset.
    
    - **dataset_id**: ID of dataset being processed
    
    Returns current processing stage and progress percentage.
    Returns None if no processing is currently active.
    """
    try:
        # Get dataset to check permissions
        stmt = select(Dataset).where(Dataset.id == dataset_id)
        result = await session.execute(stmt)
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        # Check access permissions
        if dataset.user_id != current_user.id and not dataset.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get progress from ML processor
        progress = await ml_processor.get_processing_progress(dataset_id)
        return progress
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve processing progress"
        )


@router.get(
    "/results/{dataset_id}",
    response_model=Optional[ProcessingResult],
    summary="Get processing results",
    description="Get ML processing results for a dataset."
)
async def get_processing_results(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get ML processing results for a dataset.
    
    - **dataset_id**: ID of processed dataset
    
    Returns 3D coordinates, clusters, and AI explanations if processing completed.
    Returns None if dataset hasn't been processed yet.
    """
    try:
        # Get dataset
        stmt = select(Dataset).where(Dataset.id == dataset_id)
        result = await session.execute(stmt)
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        # Check access permissions
        if dataset.user_id != current_user.id and not dataset.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if dataset has been processed
        if not dataset.is_processed or not dataset.processing_results:
            return None
        
        # Return processing results
        return ProcessingResult.model_validate(dataset.processing_results)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve processing results"
        )


@router.post(
    "/explain/{dataset_id}",
    summary="Generate explanations",
    description="Generate AI explanations for dataset processing results."
)
async def generate_explanations(
    dataset_id: str,
    language: str = "fr",
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
    rag_service: RAGService = Depends(get_rag_service),
):
    """
    Generate AI explanations for dataset processing results.
    
    - **dataset_id**: ID of processed dataset
    - **language**: Language for explanations (fr/en)
    
    Returns AI-generated explanations for clusters and patterns.
    """
    try:
        # Get dataset
        stmt = select(Dataset).where(Dataset.id == dataset_id)
        result = await session.execute(stmt)
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        # Check access permissions
        if dataset.user_id != current_user.id and not dataset.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if dataset has been processed
        if not dataset.is_processed or not dataset.processing_results:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset must be processed before generating explanations"
            )
        
        # Get processing results
        processing_result = ProcessingResult.model_validate(dataset.processing_results)
        
        # Generate explanations
        explanations = await rag_service.explain_clusters(
            processing_result=processing_result,
            dataset_metadata=dataset.metadata,
            language=language,
        )
        
        # Generate dataset summary
        summary = await rag_service.generate_dataset_summary(
            processing_result=processing_result,
            dataset_metadata=dataset.metadata,
            language=language,
        )
        
        # Generate anomaly explanation
        anomaly_explanation = await rag_service.explain_anomalies(
            processing_result=processing_result,
            dataset_metadata=dataset.metadata,
            language=language,
        )
        
        return {
            "cluster_explanations": [exp.model_dump() for exp in explanations],
            "dataset_summary": summary,
            "anomaly_explanation": anomaly_explanation,
            "language": language,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate explanations: {str(e)}"
        )


@router.get(
    "/algorithms",
    summary="Get available algorithms",
    description="Get list of available ML algorithms and their configurations."
)
async def get_available_algorithms():
    """
    Get list of available ML algorithms and their configurations.
    
    Returns information about supported reduction and clustering methods
    with their configuration options.
    """
    return {
        "reduction_methods": {
            "tsne": {
                "name": "t-SNE",
                "description": "t-Distributed Stochastic Neighbor Embedding",
                "parameters": {
                    "perplexity": {
                        "type": "float",
                        "min": 5.0,
                        "max": 50.0,
                        "default": 30.0,
                        "description": "Balance between local and global structure"
                    },
                    "learning_rate": {
                        "type": "string|float",
                        "default": "auto",
                        "description": "Learning rate for optimization"
                    },
                    "n_iter": {
                        "type": "int",
                        "min": 250,
                        "max": 5000,
                        "default": 1000,
                        "description": "Number of iterations"
                    }
                }
            },
            "umap": {
                "name": "UMAP",
                "description": "Uniform Manifold Approximation and Projection",
                "parameters": {
                    "n_neighbors": {
                        "type": "int",
                        "min": 2,
                        "max": 100,
                        "default": 15,
                        "description": "Number of neighbors to consider"
                    },
                    "min_dist": {
                        "type": "float",
                        "min": 0.0,
                        "max": 1.0,
                        "default": 0.1,
                        "description": "Minimum distance between points"
                    }
                }
            },
            "pca": {
                "name": "PCA",
                "description": "Principal Component Analysis",
                "parameters": {
                    "n_components": {
                        "type": "int",
                        "min": 2,
                        "max": 10,
                        "default": 3,
                        "description": "Number of components"
                    },
                    "whiten": {
                        "type": "bool",
                        "default": False,
                        "description": "Whiten the components"
                    }
                }
            }
        },
        "clustering_methods": {
            "kmeans": {
                "name": "K-Means",
                "description": "K-Means clustering algorithm",
                "parameters": {
                    "n_clusters": {
                        "type": "int",
                        "min": 2,
                        "max": 20,
                        "default": 3,
                        "description": "Number of clusters"
                    },
                    "init": {
                        "type": "string",
                        "options": ["k-means++", "random"],
                        "default": "k-means++",
                        "description": "Initialization method"
                    }
                }
            },
            "dbscan": {
                "name": "DBSCAN",
                "description": "Density-Based Spatial Clustering",
                "parameters": {
                    "eps": {
                        "type": "float",
                        "min": 0.1,
                        "max": 2.0,
                        "default": 0.5,
                        "description": "Maximum distance between samples"
                    },
                    "min_samples": {
                        "type": "int",
                        "min": 1,
                        "max": 20,
                        "default": 5,
                        "description": "Minimum samples in neighborhood"
                    }
                }
            },
            "hdbscan": {
                "name": "HDBSCAN",
                "description": "Hierarchical DBSCAN",
                "parameters": {
                    "min_cluster_size": {
                        "type": "int",
                        "min": 2,
                        "max": 100,
                        "default": 5,
                        "description": "Minimum cluster size"
                    }
                }
            },
            "agglomerative": {
                "name": "Agglomerative",
                "description": "Agglomerative Hierarchical Clustering",
                "parameters": {
                    "n_clusters": {
                        "type": "int",
                        "min": 2,
                        "max": 20,
                        "default": 3,
                        "description": "Number of clusters"
                    },
                    "linkage": {
                        "type": "string",
                        "options": ["ward", "complete", "average", "single"],
                        "default": "ward",
                        "description": "Linkage criterion"
                    }
                }
            }
        },
        "anomaly_detection": {
            "isolation_forest": {
                "name": "Isolation Forest",
                "description": "Anomaly detection using Isolation Forest",
                "parameters": {
                    "contamination": {
                        "type": "float",
                        "min": 0.01,
                        "max": 0.5,
                        "default": 0.1,
                        "description": "Expected contamination ratio"
                    }
                }
            }
        }
    }