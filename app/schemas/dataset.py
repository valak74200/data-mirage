"""
Pydantic schemas for dataset-related data validation and serialization.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator


class DatasetBase(BaseModel):
    """Base dataset schema with common fields."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Dataset name")
    description: Optional[str] = Field(None, max_length=1000, description="Dataset description")
    is_public: bool = Field(False, description="Whether dataset is publicly accessible")
    tags: Optional[List[str]] = Field(None, description="Dataset tags for categorization")


class DatasetCreate(DatasetBase):
    """Schema for creating a new dataset."""
    
    file_content: str = Field(..., description="File content as string")
    file_name: str = Field(..., description="Original filename")
    mime_type: str = Field(..., description="File MIME type")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Sales Data 2024",
                "description": "Monthly sales data for Q1 2024",
                "file_content": "name,sales,month\nProduct A,1000,Jan\nProduct B,1500,Jan",
                "file_name": "sales_data.csv",
                "mime_type": "text/csv",
                "is_public": False,
                "tags": ["sales", "2024", "quarterly"]
            }
        }
    )


class DatasetUpdate(BaseModel):
    """Schema for updating dataset information."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    is_public: Optional[bool] = None
    tags: Optional[List[str]] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Updated Sales Data 2024",
                "description": "Updated description with Q2 data",
                "is_public": True,
                "tags": ["sales", "2024", "quarterly", "updated"]
            }
        }
    )


class DatasetMetadata(BaseModel):
    """Schema for dataset metadata."""
    
    row_count: int = Field(..., description="Number of rows in dataset")
    column_count: int = Field(..., description="Number of columns in dataset")
    columns: List[str] = Field(..., description="List of column names")
    column_types: Dict[str, str] = Field(..., description="Column data types")
    size_mb: float = Field(..., description="Dataset size in MB")
    updated_at: str = Field(..., description="Metadata last updated timestamp")


class FileInfo(BaseModel):
    """Schema for file information."""
    
    filename: str = Field(..., description="Original filename")
    size: int = Field(..., description="File size in bytes")
    mime_type: str = Field(..., description="File MIME type")
    created_from_version: Optional[int] = Field(None, description="Version this was created from")


class DatasetResponse(DatasetBase):
    """Schema for dataset data in API responses."""
    
    id: str = Field(..., description="Dataset unique identifier")
    user_id: str = Field(..., description="Owner user ID")
    metadata: DatasetMetadata = Field(..., description="Dataset metadata")
    file_info: FileInfo = Field(..., description="Original file information")
    status: str = Field(..., description="Processing status")
    error_message: Optional[str] = Field(None, description="Error message if processing failed")
    version: int = Field(..., description="Dataset version number")
    parent_id: Optional[str] = Field(None, description="Parent dataset ID for versioning")
    row_count: int = Field(..., description="Number of rows")
    column_count: int = Field(..., description="Number of columns")
    columns: List[str] = Field(..., description="Column names")
    size_mb: float = Field(..., description="Size in MB")
    is_processed: bool = Field(..., description="Whether dataset has been processed")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    processed_at: Optional[datetime] = Field(None, description="Last processing timestamp")
    
    model_config = ConfigDict(from_attributes=True)


class DatasetDetail(DatasetResponse):
    """Extended dataset response with sample data."""
    
    sample_data: List[Dict[str, Any]] = Field(..., description="Sample rows from dataset")
    column_stats: Dict[str, Dict[str, Any]] = Field(..., description="Statistics for each column")


class DatasetWithData(DatasetResponse):
    """Dataset response including full data."""
    
    original_data: List[Dict[str, Any]] = Field(..., description="Full dataset data")
    processed_data: Optional[List[Dict[str, Any]]] = Field(None, description="Processed data")
    processing_config: Optional[Dict[str, Any]] = Field(None, description="Processing configuration")
    processing_results: Optional[Dict[str, Any]] = Field(None, description="Processing results")


class DatasetList(BaseModel):
    """Schema for paginated dataset list."""
    
    datasets: List[DatasetResponse]
    total: int = Field(..., description="Total number of datasets")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Number of datasets per page")
    pages: int = Field(..., description="Total number of pages")


class DatasetUpload(BaseModel):
    """Schema for dataset file upload."""
    
    name: Optional[str] = Field(None, description="Custom dataset name")
    description: Optional[str] = Field(None, description="Dataset description")
    is_public: bool = Field(False, description="Make dataset public")
    tags: Optional[List[str]] = Field(None, description="Dataset tags")
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if v is not None:
            if len(v) > 10:
                raise ValueError('Maximum 10 tags allowed')
            for tag in v:
                if len(tag) > 50:
                    raise ValueError('Tag length cannot exceed 50 characters')
        return v


class DatasetProcessingStatus(BaseModel):
    """Schema for dataset processing status."""
    
    dataset_id: str = Field(..., description="Dataset ID")
    status: str = Field(..., description="Current status")
    progress: Optional[float] = Field(None, ge=0, le=100, description="Processing progress percentage")
    message: Optional[str] = Field(None, description="Status message")
    error: Optional[str] = Field(None, description="Error message if failed")
    started_at: Optional[datetime] = Field(None, description="Processing start time")
    completed_at: Optional[datetime] = Field(None, description="Processing completion time")


selection_strategies = ["all", "sample", "custom"]


class ColumnSelection(BaseModel):
    """Schema for column selection in processing."""
    
    strategy: str = Field("all", description="Selection strategy")
    columns: Optional[List[str]] = Field(None, description="Specific columns to include")
    sample_size: Optional[int] = Field(None, ge=100, le=10000, description="Sample size if using sample strategy")
    
    @field_validator('strategy')
    @classmethod
    def validate_strategy(cls, v):
        if v not in selection_strategies:
            raise ValueError(f'Strategy must be one of: {selection_strategies}')
        return v


class DatasetVersion(BaseModel):
    """Schema for dataset versioning."""
    
    version: int = Field(..., description="Version number")
    description: str = Field(..., description="Version description")
    changes: List[str] = Field(..., description="List of changes made")
    created_at: datetime = Field(..., description="Version creation time")
    created_by: str = Field(..., description="User who created this version")


class DatasetStats(BaseModel):
    """Schema for dataset statistics."""
    
    total_datasets: int = Field(..., description="Total number of datasets")
    public_datasets: int = Field(..., description="Number of public datasets")
    processed_datasets: int = Field(..., description="Number of processed datasets")
    total_size_mb: float = Field(..., description="Total size of all datasets in MB")
    avg_rows_per_dataset: float = Field(..., description="Average rows per dataset")
    most_common_tags: List[Dict[str, Union[str, int]]] = Field(..., description="Most common tags")
    processing_success_rate: float = Field(..., description="Processing success rate percentage")


class DatasetSearch(BaseModel):
    """Schema for dataset search parameters."""
    
    query: Optional[str] = Field(None, description="Search query")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    status: Optional[str] = Field(None, description="Filter by status")
    is_public: Optional[bool] = Field(None, description="Filter by public status")
    min_rows: Optional[int] = Field(None, ge=0, description="Minimum number of rows")
    max_rows: Optional[int] = Field(None, ge=0, description="Maximum number of rows")
    created_after: Optional[datetime] = Field(None, description="Created after date")
    created_before: Optional[datetime] = Field(None, description="Created before date")
    sort_by: str = Field("created_at", description="Sort field")
    sort_order: str = Field("desc", description="Sort order (asc/desc)")
    
    @field_validator('sort_order')
    @classmethod
    def validate_sort_order(cls, v):
        if v not in ["asc", "desc"]:
            raise ValueError('Sort order must be "asc" or "desc"')
        return v