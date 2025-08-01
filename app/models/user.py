"""
User model for SQLAlchemy ORM.
Defines the database schema and relationships for user management.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, Column, DateTime, String, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class User(Base):
    """
    User model for authentication and profile management.
    
    Attributes:
        id: Primary key UUID
        email: Unique email address
        hashed_password: Bcrypt hashed password
        first_name: User's first name
        last_name: User's last name
        profile_image_url: URL to profile image
        is_active: Whether the user account is active
        is_admin: Whether the user has admin privileges
        email_verified: Whether the email has been verified
        last_login: Timestamp of last login
        login_count: Number of times user has logged in
        created_at: Account creation timestamp
        updated_at: Last update timestamp
        
    Relationships:
        datasets: User's uploaded datasets
        sessions: User's active sessions
    """
    
    __tablename__ = "users"
    
    # Primary key
    id: str = Column(String, primary_key=True, index=True)
    
    # Authentication fields
    email: str = Column(String, unique=True, index=True, nullable=False)
    hashed_password: str = Column(String, nullable=False)
    
    # Profile fields
    first_name: Optional[str] = Column(String, nullable=True)
    last_name: Optional[str] = Column(String, nullable=True)
    profile_image_url: Optional[str] = Column(Text, nullable=True)
    
    # Account status
    is_active: bool = Column(Boolean, default=True, nullable=False)
    is_admin: bool = Column(Boolean, default=False, nullable=False)
    email_verified: bool = Column(Boolean, default=False, nullable=False)
    
    # Login tracking
    last_login: Optional[datetime] = Column(DateTime, nullable=True)
    login_count: int = Column(Integer, default=0, nullable=False)
    
    # Password reset
    reset_token: Optional[str] = Column(String, nullable=True)
    reset_token_expires: Optional[datetime] = Column(DateTime, nullable=True)
    
    # Email verification
    verification_token: Optional[str] = Column(String, nullable=True)
    verification_token_expires: Optional[datetime] = Column(DateTime, nullable=True)
    
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
    
    # Relationships
    datasets = relationship(
        "Dataset",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    sessions = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    def __repr__(self) -> str:
        """String representation of user."""
        return f"<User(id='{self.id}', email='{self.email}')>"
    
    @property
    def full_name(self) -> str:
        """Get user's full name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.email.split("@")[0]
    
    @property
    def initials(self) -> str:
        """Get user's initials."""
        if self.first_name and self.last_name:
            return f"{self.first_name[0]}{self.last_name[0]}".upper()
        elif self.first_name:
            return self.first_name[0].upper()
        else:
            return self.email[0].upper()
    
    def update_last_login(self) -> None:
        """Update last login timestamp and increment login count."""
        self.last_login = datetime.utcnow()
        self.login_count += 1
    
    def is_password_reset_valid(self) -> bool:
        """Check if password reset token is still valid."""
        if not self.reset_token or not self.reset_token_expires:
            return False
        return datetime.utcnow() < self.reset_token_expires
    
    def is_verification_valid(self) -> bool:
        """Check if email verification token is still valid."""
        if not self.verification_token or not self.verification_token_expires:
            return False
        return datetime.utcnow() < self.verification_token_expires
    
    def clear_reset_token(self) -> None:
        """Clear password reset token."""
        self.reset_token = None
        self.reset_token_expires = None
    
    def clear_verification_token(self) -> None:
        """Clear email verification token."""
        self.verification_token = None
        self.verification_token_expires = None
    
    def verify_email(self) -> None:
        """Mark email as verified and clear verification token."""
        self.email_verified = True
        self.clear_verification_token()
    
    def deactivate(self) -> None:
        """Deactivate user account."""
        self.is_active = False
    
    def activate(self) -> None:
        """Activate user account."""
        self.is_active = True
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """
        Convert user to dictionary.
        
        Args:
            include_sensitive: Whether to include sensitive fields
            
        Returns:
            Dictionary representation of user
        """
        data = {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "initials": self.initials,
            "profile_image_url": self.profile_image_url,
            "is_active": self.is_active,
            "email_verified": self.email_verified,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "login_count": self.login_count,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        
        if include_sensitive:
            data.update({
                "is_admin": self.is_admin,
                "reset_token": self.reset_token,
                "verification_token": self.verification_token,
            })
        
        return data