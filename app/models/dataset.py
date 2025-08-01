"""
Dataset model for SQLAlchemy ORM.
Defines the database schema for dataset storage and processing.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import Column, DateTime, String, Text, JSON, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class Dataset(Base):
    """
    Dataset model for storing uploaded data and processing results.
    
    Attributes:
        id: Primary key UUID
        name: Dataset name/filename
        description: Optional dataset description
        original_data: Raw uploaded data as JSON
        processed_data: Processed data after ML operations
        metadata: Dataset metadata (columns, row count, etc.)
        file_info: Information about the original file
        processing_config: Last ML processing configuration used
        processing_results: Results from ML processing
        status: Current processing status
        error_message: Error message if processing failed
        user_id: Foreign key to user who uploaded dataset
        is_public: Whether dataset is publicly accessible
        tags: Dataset tags for categorization
        version: Dataset version number
        parent_id: Parent dataset ID for versioning
        created_at: Upload timestamp
        updated_at: Last modification timestamp
        processed_at: Last processing timestamp
        
    Relationships:
        user: User who owns this dataset
        visualizations: Visualizations created from this dataset
        children: Child datasets (versions)
        parent: Parent dataset
    """
    
    __tablename__ = "datasets"
    
    # Primary key
    id: str = Column(String, primary_key=True, index=True)
    
    # Basic information
    name: str = Column(String, nullable=False, index=True)
    description: Optional[str] = Column(Text, nullable=True)
    
    # Data storage
    original_data: List[Dict[str, Any]] = Column(JSON, nullable=False)
    processed_data: Optional[List[Dict[str, Any]]] = Column(JSON, nullable=True)
    
    # Metadata and file information  
    dataset_metadata: Dict[str, Any] = Column(JSON, nullable=False, default=lambda: {})
    file_info: Dict[str, Any] = Column(JSON, nullable=False, default=lambda: {})
    
    # Processing information
    processing_config: Optional[Dict[str, Any]] = Column(JSON, nullable=True)
    processing_results: Optional[Dict[str, Any]] = Column(JSON, nullable=True)
    
    # Status tracking
    status: str = Column(String, default="uploaded", nullable=False, index=True)
    error_message: Optional[str] = Column(Text, nullable=True)
    
    # Ownership and access
    user_id: str = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    is_public: bool = Column(Boolean, default=False, nullable=False)
    
    # Organization
    tags: Optional[List[str]] = Column(JSON, nullable=True)
    
    # Versioning
    version: int = Column(Integer, default=1, nullable=False)
    parent_id: Optional[str] = Column(String, ForeignKey("datasets.id"), nullable=True, index=True)
    
    # Timestamps
    created_at: datetime = Column(
        DateTime,
        default=func.now(),
        nullable=False,
        index=True
    )
    updated_at: datetime = Column(
        DateTime,
        default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    processed_at: Optional[datetime] = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="datasets")
    
    visualizations = relationship(
        "Visualization",
        back_populates="dataset",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    # Self-referential relationship for versioning
    children = relationship(
        "Dataset",
        backref="parent",
        remote_side=[id],
        cascade="all, delete",
        single_parent=True
    )
    
    def __repr__(self) -> str:
        """String representation of dataset."""
        return f"<Dataset(id='{self.id}', name='{self.name}', status='{self.status}')>"
    
    @property
    def row_count(self) -> int:
        """Get number of rows in the dataset."""
        return len(self.original_data) if self.original_data else 0
    
    @property
    def column_count(self) -> int:
        """Get number of columns in the dataset."""
        if not self.original_data or not self.original_data[0]:
            return 0
        return len(self.original_data[0].keys())
    
    @property
    def columns(self) -> List[str]:
        """Get list of column names."""
        if not self.original_data or not self.original_data[0]:
            return []
        return list(self.original_data[0].keys())
    
    @property
    def size_mb(self) -> float:
        """Get approximate dataset size in MB."""
        if not self.file_info:
            return 0.0
        return self.file_info.get("size", 0) / (1024 * 1024)
    
    @property
    def is_processed(self) -> bool:
        """Check if dataset has been processed."""
        return self.status == "processed" and self.processed_data is not None
    
    @property
    def is_processing(self) -> bool:
        """Check if dataset is currently being processed."""
        return self.status == "processing"
    
    @property
    def has_error(self) -> bool:
        """Check if dataset processing failed."""
        return self.status == "error"
    
    def update_metadata(self) -> None:
        """Update metadata based on current data."""
        if not self.original_data:
            return
        
        # Initialize metadata if it's None (defensive programming)
        if self.dataset_metadata is None:
            self.dataset_metadata = {}
        
        sample_data = self.original_data[0] if self.original_data else {}
        
        # Analyze column types
        column_types = {}
        for column in sample_data.keys():
            values = [row.get(column) for row in self.original_data[:100] if row.get(column) is not None]
            if not values:
                column_types[column] = "unknown"
                continue
            
            # Check if all values are numeric
            try:
                [float(v) for v in values]
                column_types[column] = "numeric"
            except (ValueError, TypeError):
                column_types[column] = "categorical"
        
        self.dataset_metadata.update({
            "row_count": self.row_count,
            "column_count": self.column_count,
            "columns": self.columns,
            "column_types": column_types,
            "updated_at": datetime.utcnow().isoformat(),
        })
    
    def set_processing(self) -> None:
        """Set dataset status to processing."""
        self.status = "processing"
        self.error_message = None
    
    def set_processed(self, results: Dict[str, Any]) -> None:
        """
        Set dataset as successfully processed.
        
        Args:
            results: Processing results to store
        """
        self.status = "processed"
        self.processing_results = results
        self.processed_at = func.now()
        self.error_message = None
    
    def set_error(self, error_message: str) -> None:
        """
        Set dataset processing error.
        
        Args:
            error_message: Error description
        """
        self.status = "error"
        self.error_message = error_message
        self.processing_results = None
    
    def create_version(self, new_data: List[Dict[str, Any]], description: str = None) -> "Dataset":
        """
        Create a new version of this dataset.
        
        Args:
            new_data: New dataset data
            description: Optional description for the new version
            
        Returns:
            New dataset version
        """
        import uuid
        
        new_dataset = Dataset(
            id=str(uuid.uuid4()),
            name=f"{self.name} v{self.version + 1}",
            description=description or f"Version {self.version + 1} of {self.name}",
            original_data=new_data,
            user_id=self.user_id,
            parent_id=self.id,
            version=self.version + 1,
            is_public=self.is_public,
            tags=self.tags.copy() if self.tags else None,
            dataset_metadata={},  # Initialize empty metadata dictionary
            file_info={
                "filename": f"{self.name}_v{self.version + 1}",
                "size": len(str(new_data).encode('utf-8')),
                "mime_type": "application/json",
                "created_from_version": self.version,
            }
        )
        
        new_dataset.update_metadata()
        return new_dataset
    
    def get_sample_data(self, n: int = 5) -> List[Dict[str, Any]]:
        """
        Get sample rows from the dataset.
        
        Args:
            n: Number of sample rows to return
            
        Returns:
            List of sample data rows
        """
        if not self.original_data:
            return []
        return self.original_data[:n]
    
    def get_column_stats(self, column: str) -> Dict[str, Any]:
        """
        Get statistics for a specific column.
        
        Args:
            column: Column name
            
        Returns:
            Dictionary with column statistics
        """
        if not self.original_data or column not in self.columns:
            return {}
        
        values = [row.get(column) for row in self.original_data if row.get(column) is not None]
        
        if not values:
            return {"count": 0, "null_count": len(self.original_data)}
        
        stats = {
            "count": len(values),
            "null_count": len(self.original_data) - len(values),
            "unique_count": len(set(values)),
        }
        
        # Try to get numeric statistics
        try:
            numeric_values = [float(v) for v in values]
            import statistics
            
            stats.update({
                "type": "numeric",
                "min": min(numeric_values),
                "max": max(numeric_values),
                "mean": statistics.mean(numeric_values),
                "median": statistics.median(numeric_values),
                "std": statistics.stdev(numeric_values) if len(numeric_values) > 1 else 0,
            })
        except (ValueError, TypeError):
            # Categorical data
            from collections import Counter
            value_counts = Counter(values)
            
            stats.update({
                "type": "categorical",
                "most_common": value_counts.most_common(5),
            })
        
        return stats
    
    def to_dict(self, include_data: bool = False) -> Dict[str, Any]:
        """
        Convert dataset to dictionary.
        
        Args:
            include_data: Whether to include the actual data
            
        Returns:
            Dictionary representation of dataset
        """
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "metadata": self.dataset_metadata,
            "file_info": self.file_info,
            "status": self.status,
            "error_message": self.error_message,
            "user_id": self.user_id,
            "is_public": self.is_public,
            "tags": self.tags,
            "version": self.version,
            "parent_id": self.parent_id,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "columns": self.columns,
            "size_mb": self.size_mb,
            "is_processed": self.is_processed,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
        }
        
        if include_data:
            data.update({
                "original_data": self.original_data,
                "processed_data": self.processed_data,
                "processing_config": self.processing_config,
                "processing_results": self.processing_results,
            })
        
        return data