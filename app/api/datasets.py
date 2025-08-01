"""
Dataset management API routes for uploading, managing, and processing datasets.
"""

import os
import uuid
import json
import csv
import io
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete

from core.deps import (
    get_async_session,
    get_current_active_user,
    get_pagination_params,
    validate_file_upload,
    PaginationParams,
)
from models.user import User
from models.dataset import Dataset
from schemas.dataset import (
    DatasetResponse,
    DatasetDetail,
    DatasetWithData,
    DatasetList,
    DatasetUpdate,
    DatasetUpload,
    DatasetSearch,
    DatasetStats,
)
from core.config import settings

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.post(
    "/upload",
    response_model=DatasetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload dataset",
    description="Upload a new dataset file (CSV, JSON, Excel)."
)
async def upload_dataset(
    file: UploadFile = File(..., description="Dataset file to upload"),
    name: Optional[str] = Form(None, description="Custom dataset name"),
    description: Optional[str] = Form(None, description="Dataset description"),
    is_public: bool = Form(False, description="Make dataset public"),
    tags: Optional[str] = Form(None, description="Comma-separated tags"),
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Upload a new dataset file.
    
    Supported formats:
    - CSV (.csv)
    - JSON (.json)
    - Excel (.xlsx, .xls)
    
    Parameters:
    - **file**: Dataset file to upload
    - **name**: Optional custom name (defaults to filename)
    - **description**: Optional description
    - **is_public**: Make dataset publicly accessible
    - **tags**: Comma-separated list of tags
    
    Returns dataset information with metadata.
    """
    try:
        # Read file content first for validation
        content = await file.read()
        
        # Comprehensive file validation with content check
        await validate_file_upload(
            file_size=file.size,
            file_type=file.content_type,
            file_content=content,
            filename=file.filename
        )
        
        # Parse data based on file type
        if file.filename.endswith('.csv') or file.content_type == 'text/csv':
            data = await _parse_csv(content)
        elif file.filename.endswith('.json') or file.content_type == 'application/json':
            data = await _parse_json(content)
        elif file.filename.endswith(('.xlsx', '.xls')):
            data = await _parse_excel(content, file.filename)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format. Supported: CSV, JSON, Excel"
            )
        
        if not data or len(data) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset is empty or could not be parsed"
            )
        
        # Process tags
        tag_list = None
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        
        # Create dataset
        dataset = Dataset(
            id=str(uuid.uuid4()),
            name=name or file.filename,
            description=description,
            original_data=data,
            user_id=current_user.id,
            is_public=is_public,
            tags=tag_list,
            status="uploaded",
            dataset_metadata={},  # Initialize empty metadata dictionary
            file_info={
                "filename": file.filename,
                "size": file.size,
                "mime_type": file.content_type,
                "upload_timestamp": datetime.now().isoformat(),
            }
        )
        
        # Update metadata
        dataset.update_metadata()
        
        # Save to database
        session.add(dataset)
        await session.commit()
        
        return DatasetResponse.model_validate(dataset)
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload dataset: {str(e)}"
        )


@router.get(
    "/",
    response_model=DatasetList,
    summary="List datasets",
    description="Get paginated list of datasets."
)
async def list_datasets(
    pagination: PaginationParams = Depends(get_pagination_params),
    search: Optional[str] = Query(None, description="Search in name and description"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    is_public: Optional[bool] = Query(None, description="Filter by public status"),
    my_datasets: bool = Query(False, description="Show only current user's datasets"),
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get paginated list of datasets.
    
    Query parameters:
    - **skip**: Number of records to skip (pagination)
    - **limit**: Number of records to return
    - **search**: Search term for name and description
    - **tags**: Filter by tags (comma-separated)
    - **status**: Filter by processing status
    - **is_public**: Filter by public visibility
    - **my_datasets**: Show only current user's datasets
    
    Returns accessible datasets (owned by user or public).
    """
    try:
        # Build base query
        query = select(Dataset)
        count_query = select(func.count(Dataset.id))
        
        # Apply access filter (own datasets or public ones)
        if my_datasets:
            access_filter = Dataset.user_id == current_user.id
        else:
            access_filter = (Dataset.user_id == current_user.id) | (Dataset.is_public == True)
        
        query = query.where(access_filter)
        count_query = count_query.where(access_filter)
        
        # Apply additional filters
        if search:
            search_term = f"%{search.lower()}%"
            search_filter = (
                func.lower(Dataset.name).like(search_term) |
                func.lower(Dataset.description).like(search_term)
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        if tags:
            tag_list = [tag.strip().lower() for tag in tags.split(',') if tag.strip()]
            # PostgreSQL JSON contains operation
            for tag in tag_list:
                query = query.where(func.lower(Dataset.tags.astext).like(f"%{tag}%"))
                count_query = count_query.where(func.lower(Dataset.tags.astext).like(f"%{tag}%"))
        
        if status_filter:
            query = query.where(Dataset.status == status_filter)
            count_query = count_query.where(Dataset.status == status_filter)
        
        if is_public is not None:
            query = query.where(Dataset.is_public == is_public)
            count_query = count_query.where(Dataset.is_public == is_public)
        
        # Get total count
        count_result = await session.execute(count_query)
        total = count_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(Dataset.created_at.desc())
        query = query.offset(pagination.skip).limit(pagination.limit)
        
        # Execute query
        result = await session.execute(query)
        datasets = result.scalars().all()
        
        # Convert to response models
        dataset_responses = [DatasetResponse.model_validate(dataset) for dataset in datasets]
        
        # Calculate pagination info
        pages = (total + pagination.limit - 1) // pagination.limit
        page = (pagination.skip // pagination.limit) + 1
        
        return DatasetList(
            datasets=dataset_responses,
            total=total,
            page=page,
            per_page=pagination.limit,
            pages=pages,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve datasets"
        )


@router.get(
    "/{dataset_id}",
    response_model=DatasetDetail,
    summary="Get dataset",
    description="Get specific dataset with sample data."
)
async def get_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get specific dataset information with sample data.
    
    - **dataset_id**: Dataset ID to retrieve
    
    Returns dataset details including sample data and column statistics.
    Access restricted to dataset owner or public datasets.
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
                detail="Access denied. Dataset is private."
            )
        
        # Create detailed response
        dataset_detail = DatasetDetail.model_validate(dataset)
        
        # Add sample data
        dataset_detail.sample_data = dataset.get_sample_data(5)
        
        # Add column statistics
        column_stats = {}
        for column in dataset.columns:
            column_stats[column] = dataset.get_column_stats(column)
        dataset_detail.column_stats = column_stats
        
        return dataset_detail
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dataset"
        )


@router.get(
    "/{dataset_id}/data",
    response_model=DatasetWithData,
    summary="Get dataset with full data",
    description="Get dataset with complete data (owner only)."
)
async def get_dataset_data(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get dataset with complete data.
    
    - **dataset_id**: Dataset ID to retrieve
    
    **Warning**: Returns full dataset data. Only available to dataset owner.
    May be large response for big datasets.
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
        
        # Check ownership (full data only for owners)
        if dataset.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Full data access requires ownership."
            )
        
        return DatasetWithData.model_validate(dataset)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dataset data"
        )


@router.put(
    "/{dataset_id}",
    response_model=DatasetResponse,
    summary="Update dataset",
    description="Update dataset information."
)
async def update_dataset(
    dataset_id: str,
    update_data: DatasetUpdate,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Update dataset information.
    
    - **dataset_id**: Dataset ID to update
    - **name**: Updated name
    - **description**: Updated description
    - **is_public**: Updated visibility
    - **tags**: Updated tags
    
    Only dataset owner can update dataset information.
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
        
        # Check ownership
        if dataset.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only dataset owner can update."
            )
        
        # Update fields
        update_fields = update_data.model_dump(exclude_unset=True)
        for field, value in update_fields.items():
            setattr(dataset, field, value)
        
        await session.commit()
        
        return DatasetResponse.model_validate(dataset)
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update dataset"
        )


@router.delete(
    "/{dataset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete dataset",
    description="Delete a dataset."
)
async def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Delete a dataset.
    
    - **dataset_id**: Dataset ID to delete
    
    **Warning**: This permanently deletes the dataset and all associated
    visualizations. This action cannot be undone.
    
    Only dataset owner can delete dataset.
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
        
        # Check ownership
        if dataset.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only dataset owner can delete."
            )
        
        # Delete dataset (cascading will handle visualizations)
        await session.delete(dataset)
        await session.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete dataset"
        )


@router.get(
    "/{dataset_id}/stats",
    summary="Get dataset statistics",
    description="Get detailed statistics for a dataset."
)
async def get_dataset_stats(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get detailed statistics for a dataset.
    
    - **dataset_id**: Dataset ID to get stats for
    
    Returns comprehensive dataset statistics including column analysis.
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
        
        # Check access
        if dataset.user_id != current_user.id and not dataset.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Dataset is private."
            )
        
        # Generate comprehensive statistics
        stats = {
            "dataset_id": dataset_id,
            "basic_info": {
                "name": dataset.name,
                "row_count": dataset.row_count,
                "column_count": dataset.column_count,
                "size_mb": dataset.size_mb,
                "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
            },
            "columns": {},
            "processing_history": {
                "status": dataset.status,
                "last_processed": dataset.processed_at.isoformat() if dataset.processed_at else None,
                "processing_count": 1 if dataset.is_processed else 0,
            }
        }
        
        # Add column statistics
        for column in dataset.columns:
            stats["columns"][column] = dataset.get_column_stats(column)
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dataset statistics"
        )


async def _parse_csv(content: bytes) -> List[Dict[str, Any]]:
    """Parse CSV file content."""
    try:
        # Decode content
        text_content = content.decode('utf-8')
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(text_content))
        data = []
        
        for row in csv_reader:
            # Convert values to appropriate types
            parsed_row = {}
            for key, value in row.items():
                if value is None or value == '':
                    parsed_row[key] = None
                else:
                    # Try to convert to number
                    try:
                        if '.' in value:
                            parsed_row[key] = float(value)
                        else:
                            parsed_row[key] = int(value)
                    except (ValueError, TypeError):
                        parsed_row[key] = value
            
            data.append(parsed_row)
        
        return data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV file: {str(e)}"
        )


async def _parse_json(content: bytes) -> List[Dict[str, Any]]:
    """Parse JSON file content."""
    try:
        # Decode and parse JSON
        text_content = content.decode('utf-8')
        data = json.loads(text_content)
        
        # Ensure it's a list of dictionaries
        if isinstance(data, dict):
            # Single object, wrap in list
            data = [data]
        elif not isinstance(data, list):
            raise ValueError("JSON must be an array of objects or a single object")
        
        # Validate structure
        for item in data:
            if not isinstance(item, dict):
                raise ValueError("All items must be objects")
        
        return data
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse JSON file: {str(e)}"
        )


async def _parse_excel(content: bytes, filename: str) -> List[Dict[str, Any]]:
    """Parse Excel file content."""
    try:
        import pandas as pd
        
        # Read Excel file
        df = pd.read_excel(io.BytesIO(content))
        
        # Convert to list of dictionaries
        data = df.to_dict('records')
        
        # Clean up NaN values
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
        
        return data
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Excel support not available. Please install pandas and openpyxl."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse Excel file: {str(e)}"
        )