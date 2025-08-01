"""
Session model for SQLAlchemy ORM.
Defines the database schema for user session management.
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy import Column, DateTime, String, JSON, ForeignKey, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class Session(Base):
    """
    Session model for tracking user sessions and refresh tokens.
    
    Attributes:
        id: Primary key (session ID)
        user_id: Foreign key to user
        refresh_token: Hashed refresh token
        device_info: Information about the user's device
        ip_address: IP address from which session was created
        user_agent: Browser/client user agent
        is_active: Whether session is currently active
        expires_at: Session expiration timestamp
        last_used: Last time session was used
        created_at: Session creation timestamp
        revoked_at: When session was revoked (if applicable)
        
    Relationships:
        user: User who owns this session
    """
    
    __tablename__ = "sessions"
    
    # Primary key
    id: str = Column(String, primary_key=True, index=True)
    
    # User relationship
    user_id: str = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Token information
    refresh_token: str = Column(String, nullable=False, unique=True, index=True)
    
    # Device and location tracking
    device_info: Optional[Dict[str, Any]] = Column(JSON, nullable=True)
    ip_address: Optional[str] = Column(String, nullable=True)
    user_agent: Optional[str] = Column(Text, nullable=True)
    
    # Session status
    is_active: bool = Column(Boolean, default=True, nullable=False, index=True)
    
    # Timing
    expires_at: datetime = Column(DateTime, nullable=False, index=True)
    last_used: datetime = Column(DateTime, default=func.now(), nullable=False)
    created_at: datetime = Column(DateTime, default=func.now(), nullable=False)
    revoked_at: Optional[datetime] = Column(DateTime, nullable=True)
    
    # Additional metadata
    session_data: Optional[Dict[str, Any]] = Column(JSON, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self) -> str:
        """String representation of session."""
        return f"<Session(id='{self.id}', user_id='{self.user_id}', active='{self.is_active}')>"
    
    @property
    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_valid(self) -> bool:
        """Check if session is valid (active and not expired)."""
        return self.is_active and not self.is_expired
    
    @property
    def time_until_expiry(self) -> int:
        """Get seconds until session expires."""
        if self.is_expired:
            return 0
        delta = self.expires_at - datetime.utcnow()
        return int(delta.total_seconds())
    
    @property
    def device_name(self) -> str:
        """Get human-readable device name."""
        if not self.device_info:
            return "Unknown Device"
        
        device = self.device_info.get("device", "Unknown")
        browser = self.device_info.get("browser", "Unknown")
        os = self.device_info.get("os", "Unknown")
        
        return f"{browser} on {os} ({device})"
    
    def update_last_used(self) -> None:
        """Update last used timestamp."""
        self.last_used = func.now()
    
    def revoke(self) -> None:
        """Revoke the session."""
        self.is_active = False
        self.revoked_at = func.now()
    
    def extend_expiry(self, days: int = 7) -> None:
        """
        Extend session expiry.
        
        Args:
            days: Number of days to extend
        """
        from datetime import timedelta
        self.expires_at = datetime.utcnow() + timedelta(days=days)
    
    def is_from_same_device(self, other_session: "Session") -> bool:
        """
        Check if session is from the same device as another session.
        
        Args:
            other_session: Another session to compare
            
        Returns:
            True if from same device
        """
        if not self.device_info or not other_session.device_info:
            return False
        
        return (
            self.device_info.get("fingerprint") == other_session.device_info.get("fingerprint")
            or (
                self.ip_address == other_session.ip_address
                and self.user_agent == other_session.user_agent
            )
        )
    
    def cleanup_expired(self) -> None:
        """Mark expired sessions as inactive."""
        if self.is_expired and self.is_active:
            self.is_active = False
            self.revoked_at = func.now()
    
    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """
        Convert session to dictionary.
        
        Args:
            include_sensitive: Whether to include sensitive information
            
        Returns:
            Dictionary representation of session
        """
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "device_name": self.device_name,
            "ip_address": self.ip_address,
            "is_active": self.is_active,
            "is_expired": self.is_expired,
            "expires_at": self.expires_at.isoformat(),
            "last_used": self.last_used.isoformat(),
            "created_at": self.created_at.isoformat(),
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "time_until_expiry": self.time_until_expiry,
        }
        
        if include_sensitive:
            data.update({
                "refresh_token": self.refresh_token,
                "device_info": self.device_info,
                "user_agent": self.user_agent,
                "session_data": self.session_data,
            })
        
        return data


class Visualization(Base):
    """
    Visualization model for storing 3D visualization configurations and results.
    
    Attributes:
        id: Primary key UUID
        dataset_id: Foreign key to associated dataset
        user_id: Foreign key to user who created visualization
        name: Visualization name
        description: Optional description
        config: ML processing configuration used
        results: Processing results and 3D coordinates
        thumbnail: Optional thumbnail image data
        is_public: Whether visualization is publicly accessible
        view_count: Number of times visualization has been viewed
        liked_by: List of user IDs who liked this visualization
        created_at: Creation timestamp
        updated_at: Last modification timestamp
        
    Relationships:
        dataset: Associated dataset
        user: User who created this visualization
    """
    
    __tablename__ = "visualizations"
    
    # Primary key
    id: str = Column(String, primary_key=True, index=True)
    
    # Relationships
    dataset_id: str = Column(String, ForeignKey("datasets.id"), nullable=False, index=True)
    user_id: str = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Basic information
    name: str = Column(String, nullable=False)
    description: Optional[str] = Column(Text, nullable=True)
    
    # Visualization data
    config: Dict[str, Any] = Column(JSON, nullable=False)
    results: Dict[str, Any] = Column(JSON, nullable=False)
    
    # Media
    thumbnail: Optional[str] = Column(Text, nullable=True)  # Base64 encoded image
    
    # Access control
    is_public: bool = Column(Boolean, default=False, nullable=False)
    
    # Engagement metrics
    view_count: int = Column(Integer, default=0, nullable=False)
    liked_by: Optional[List[str]] = Column(JSON, nullable=True)
    
    # Timestamps
    created_at: datetime = Column(DateTime, default=func.now(), nullable=False, index=True)
    updated_at: datetime = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="visualizations")
    user = relationship("User")
    
    def __repr__(self) -> str:
        """String representation of visualization."""
        return f"<Visualization(id='{self.id}', name='{self.name}')>"
    
    @property
    def like_count(self) -> int:
        """Get number of likes."""
        return len(self.liked_by) if self.liked_by else 0
    
    def increment_view_count(self) -> None:
        """Increment view count."""
        self.view_count += 1
    
    def add_like(self, user_id: str) -> None:
        """
        Add a like from a user.
        
        Args:
            user_id: ID of user who liked the visualization
        """
        if not self.liked_by:
            self.liked_by = []
        
        if user_id not in self.liked_by:
            self.liked_by.append(user_id)
    
    def remove_like(self, user_id: str) -> None:
        """
        Remove a like from a user.
        
        Args:
            user_id: ID of user who unliked the visualization
        """
        if self.liked_by and user_id in self.liked_by:
            self.liked_by.remove(user_id)
    
    def is_liked_by(self, user_id: str) -> bool:
        """
        Check if visualization is liked by a specific user.
        
        Args:
            user_id: ID of user to check
            
        Returns:
            True if user has liked this visualization
        """
        return bool(self.liked_by and user_id in self.liked_by)
    
    def to_dict(self, include_results: bool = True) -> Dict[str, Any]:
        """
        Convert visualization to dictionary.
        
        Args:
            include_results: Whether to include processing results
            
        Returns:
            Dictionary representation of visualization
        """
        data = {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "config": self.config,
            "thumbnail": self.thumbnail,
            "is_public": self.is_public,
            "view_count": self.view_count,
            "like_count": self.like_count,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        
        if include_results:
            data["results"] = self.results
        
        return data