"""
Authentication API routes for user registration, login, and account management.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import (
    get_async_session,
    get_current_user,
    get_current_active_user,
    check_rate_limit,
)
from models.user import User
from schemas.user import (
    UserCreate,
    UserUpdate,
    UserLogin,
    TokenResponse,
    RefreshToken,
    UserResponse,
    UserProfile,
    PasswordChange,
    PasswordReset,
    PasswordResetConfirm,
    SessionResponse,
)
from services.auth import (
    AuthService,
    UserExistsError,
    InvalidCredentialsError,
    AccountDisabledError,
    UserNotFoundError,
    AuthenticationError,
)
from core.security import SecurityError, PasswordError, TokenError

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account and return authentication tokens."
)
async def register(
    user_data: UserCreate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    _: None = Depends(check_rate_limit),
):
    """
    Register a new user account.
    
    - **email**: Valid email address (will be used for login)
    - **password**: Strong password (min 8 characters)
    - **confirm_password**: Must match password
    - **first_name**: Optional first name
    - **last_name**: Optional last name
    - **profile_image_url**: Optional profile image URL
    
    Returns JWT access and refresh tokens along with user information.
    """
    try:
        auth_service = AuthService(session)
        
        # Extract device/client information
        device_info = {
            "user_agent": request.headers.get("user-agent", "Unknown"),
            "platform": "web",
        }
        
        # Register user
        token_response = await auth_service.register_user(
            user_data=user_data,
            device_info=device_info,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        
        return token_response
        
    except UserExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except PasswordError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SecurityError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
    description="Authenticate user with email and password."
)
async def login(
    login_data: UserLogin,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    _: None = Depends(check_rate_limit),
):
    """
    Authenticate user with email and password.
    
    - **email**: User's email address
    - **password**: User's password
    - **remember_me**: Extend session duration if true
    
    Returns JWT access and refresh tokens along with user information.
    """
    try:
        auth_service = AuthService(session)
        
        # Extract device/client information
        device_info = {
            "user_agent": request.headers.get("user-agent", "Unknown"),
            "platform": "web",
        }
        
        # Authenticate user
        token_response = await auth_service.authenticate_user(
            email=login_data.email,
            password=login_data.password,
            device_info=device_info,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            remember_me=login_data.remember_me,
        )
        
        return token_response
        
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except AccountDisabledError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Get new access token using refresh token."
)
async def refresh_token(
    refresh_data: RefreshToken,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Refresh access token using a valid refresh token.
    
    - **refresh_token**: Valid refresh token from previous login
    
    Returns new JWT access and refresh tokens.
    """
    try:
        auth_service = AuthService(session)
        
        # Extract device/client information for validation
        device_info = {
            "user_agent": request.headers.get("user-agent", "Unknown"),
            "platform": "web",
        }
        
        # Refresh token
        token_response = await auth_service.refresh_access_token(
            refresh_token=refresh_data.refresh_token,
            device_info=device_info,
        )
        
        return token_response
        
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="User logout",
    description="Logout user and revoke session tokens."
)
async def logout(
    all_sessions: bool = False,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Logout user and revoke session tokens.
    
    - **all_sessions**: If true, revoke all user sessions on all devices
    
    Revokes the current session or all sessions if specified.
    """
    try:
        auth_service = AuthService(session)
        
        # Logout user (revoke sessions)
        await auth_service.logout_user(
            user_id=current_user.id,
            all_sessions=all_sessions,
        )
        
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get current user profile",
    description="Get current authenticated user's profile information."
)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get current user's profile information.
    
    Returns detailed user profile including:
    - Basic user information
    - Account statistics
    - Preferences
    """
    # Convert user to profile response
    user_profile = UserProfile.model_validate(current_user)
    
    # Add additional profile information
    # TODO: Add dataset and visualization counts
    user_profile.datasets_count = 0
    user_profile.visualizations_count = 0
    
    return user_profile


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update user profile",
    description="Update current user's profile information."
)
async def update_user_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Update current user's profile information.
    
    - **first_name**: Updated first name
    - **last_name**: Updated last name
    - **profile_image_url**: Updated profile image URL
    
    Returns updated user information.
    """
    try:
        auth_service = AuthService(session)
        
        updated_user = await auth_service.update_user_profile(
            user_id=current_user.id,
            update_data=update_data,
        )
        
        return UserResponse.model_validate(updated_user)
        
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change password",
    description="Change user's password."
)
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Change user's password.
    
    - **current_password**: Current password for verification
    - **new_password**: New password (must meet strength requirements)
    - **confirm_password**: Must match new password
    
    Requires current password verification. Optionally revokes other sessions.
    """
    # Check password confirmation
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match"
        )
    
    try:
        auth_service = AuthService(session)
        
        await auth_service.change_password(
            user_id=current_user.id,
            current_password=password_data.current_password,
            new_password=password_data.new_password,
            revoke_other_sessions=True,
        )
        
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PasswordError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


@router.get(
    "/sessions",
    response_model=List[SessionResponse],
    summary="Get user sessions",
    description="Get all active sessions for current user."
)
async def get_user_sessions(
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get all active sessions for the current user.
    
    Returns list of active sessions with device information and timestamps.
    Useful for security monitoring and session management.
    """
    try:
        auth_service = AuthService(session)
        
        sessions = await auth_service.get_user_sessions(current_user.id)
        return sessions
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions"
        )


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke session",
    description="Revoke a specific user session."
)
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Revoke a specific user session.
    
    - **session_id**: ID of session to revoke
    
    Allows users to remotely logout from other devices.
    """
    try:
        auth_service = AuthService(session)
        
        success = await auth_service.logout_user(
            user_id=current_user.id,
            session_id=session_id,
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
            
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session"
        )


# Password reset endpoints (for future implementation)
@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Request password reset",
    description="Request password reset email."
)
async def request_password_reset(
    reset_data: PasswordReset,
    session: AsyncSession = Depends(get_async_session),
    _: None = Depends(check_rate_limit),
):
    """
    Request password reset email.
    
    - **email**: Email address to send reset link to
    
    Sends password reset email if account exists. Always returns success
    for security (doesn't reveal if account exists).
    """
    # TODO: Implement password reset email functionality
    # For now, just return success
    pass


@router.post(
    "/reset-password/confirm",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Confirm password reset",
    description="Reset password using reset token."
)
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Reset password using reset token from email.
    
    - **token**: Password reset token from email
    - **new_password**: New password
    - **confirm_password**: Must match new password
    """
    # Check password confirmation
    if reset_data.new_password != reset_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # TODO: Implement password reset confirmation
    # For now, just return success
    pass