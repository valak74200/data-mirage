"""
Pydantic schemas for user-related data validation and serialization.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    """Base user schema with common fields."""
    
    email: EmailStr = Field(..., description="User's email address")
    first_name: Optional[str] = Field(None, min_length=1, max_length=50, description="User's first name")
    last_name: Optional[str] = Field(None, min_length=1, max_length=50, description="User's last name")
    profile_image_url: Optional[str] = Field(None, description="URL to user's profile image")


class UserCreate(UserBase):
    """Schema for creating a new user."""
    
    password: str = Field(..., min_length=8, max_length=128, description="User's password")
    confirm_password: str = Field(..., description="Password confirmation")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "securepassword123",
                "confirm_password": "securepassword123",
                "first_name": "John",
                "last_name": "Doe"
            }
        }
    )


class UserUpdate(BaseModel):
    """Schema for updating user information."""
    
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    profile_image_url: Optional[str] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "first_name": "John",
                "last_name": "Smith",
                "profile_image_url": "https://example.com/avatar.jpg"
            }
        }
    )


class UserResponse(UserBase):
    """Schema for user data in API responses."""
    
    id: str = Field(..., description="User's unique identifier")
    full_name: str = Field(..., description="User's full name")
    initials: str = Field(..., description="User's initials")
    is_active: bool = Field(..., description="Whether user account is active")
    email_verified: bool = Field(..., description="Whether email has been verified")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    login_count: int = Field(..., description="Number of times user has logged in")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    model_config = ConfigDict(from_attributes=True)


class UserProfile(UserResponse):
    """Extended user profile with additional details."""
    
    datasets_count: Optional[int] = Field(None, description="Number of datasets owned by user")
    visualizations_count: Optional[int] = Field(None, description="Number of visualizations created by user")
    last_dataset_uploaded: Optional[datetime] = Field(None, description="Last dataset upload timestamp")
    
    model_config = ConfigDict(from_attributes=True)


class UserList(BaseModel):
    """Schema for paginated user list."""
    
    users: List[UserResponse]
    total: int = Field(..., description="Total number of users")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Number of users per page")
    pages: int = Field(..., description="Total number of pages")


class PasswordChange(BaseModel):
    """Schema for password change requests."""
    
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")
    confirm_password: str = Field(..., description="New password confirmation")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "current_password": "oldpassword123",
                "new_password": "newpassword456",
                "confirm_password": "newpassword456"
            }
        }
    )


class PasswordReset(BaseModel):
    """Schema for password reset requests."""
    
    email: EmailStr = Field(..., description="Email address to send reset link")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com"
            }
        }
    )


class PasswordResetConfirm(BaseModel):
    """Schema for confirming password reset."""
    
    token: str = Field(..., description="Password reset token")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")
    confirm_password: str = Field(..., description="New password confirmation")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "token": "reset-token-here",
                "new_password": "newpassword123",
                "confirm_password": "newpassword123"
            }
        }
    )


class EmailVerification(BaseModel):
    """Schema for email verification."""
    
    token: str = Field(..., description="Email verification token")


class UserLogin(BaseModel):
    """Schema for user login."""
    
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")
    remember_me: bool = Field(False, description="Whether to remember the login")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "password123",
                "remember_me": True
            }
        }
    )


class TokenResponse(BaseModel):
    """Schema for authentication token response."""
    
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    user: UserResponse = Field(..., description="User information")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "token_type": "bearer",
                "expires_in": 1800,
                "user": {
                    "id": "user-id",
                    "email": "user@example.com",
                    "full_name": "John Doe"
                }
            }
        }
    )


class RefreshToken(BaseModel):
    """Schema for token refresh requests."""
    
    refresh_token: str = Field(..., description="Refresh token")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
            }
        }
    )


class SessionResponse(BaseModel):
    """Schema for user session information."""
    
    id: str = Field(..., description="Session ID")
    device_name: str = Field(..., description="Device name")
    ip_address: Optional[str] = Field(None, description="IP address")
    is_active: bool = Field(..., description="Whether session is active")
    is_current: bool = Field(False, description="Whether this is the current session")
    expires_at: datetime = Field(..., description="Session expiration time")
    last_used: datetime = Field(..., description="Last usage time")
    created_at: datetime = Field(..., description="Session creation time")
    
    model_config = ConfigDict(from_attributes=True)


class UserSettings(BaseModel):
    """Schema for user settings."""
    
    email_notifications: bool = Field(True, description="Enable email notifications")
    dataset_public_by_default: bool = Field(False, description="Make datasets public by default")
    preferred_theme: str = Field("light", description="Preferred UI theme")
    preferred_language: str = Field("en", description="Preferred language")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email_notifications": True,
                "dataset_public_by_default": False,
                "preferred_theme": "dark",
                "preferred_language": "fr"
            }
        }
    )