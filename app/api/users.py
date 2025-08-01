"""
User management API routes for admin operations and user profiles.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.deps import (
    get_async_session,
    get_current_admin_user,
    get_current_active_user,
    get_pagination_params,
    PaginationParams,
)
from models.user import User
from schemas.user import (
    UserResponse,
    UserProfile,
    UserList,
)
from services.auth import AuthService, UserNotFoundError

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/",
    response_model=UserList,
    summary="List users",
    description="Get paginated list of users (admin only)."
)
async def list_users(
    pagination: PaginationParams = Depends(get_pagination_params),
    search: Optional[str] = Query(None, description="Search by email, first name, or last name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get paginated list of users (admin only).
    
    Query parameters:
    - **skip**: Number of records to skip (pagination)
    - **limit**: Number of records to return (max 1000)
    - **search**: Search term for email, first name, or last name
    - **is_active**: Filter by active status
    
    Returns paginated list of users with total count and pagination info.
    """
    try:
        # Build query
        query = select(User)
        count_query = select(func.count(User.id))
        
        # Apply filters
        if search:
            search_term = f"%{search.lower()}%"
            search_filter = (
                func.lower(User.email).like(search_term) |
                func.lower(User.first_name).like(search_term) |
                func.lower(User.last_name).like(search_term)
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)
        
        # Get total count
        count_result = await session.execute(count_query)
        total = count_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(User.created_at.desc())
        query = query.offset(pagination.skip).limit(pagination.limit)
        
        # Execute query
        result = await session.execute(query)
        users = result.scalars().all()
        
        # Convert to response models
        user_responses = [UserResponse.model_validate(user) for user in users]
        
        # Calculate pagination info
        pages = (total + pagination.limit - 1) // pagination.limit
        page = (pagination.skip // pagination.limit) + 1
        
        return UserList(
            users=user_responses,
            total=total,
            page=page,
            per_page=pagination.limit,
            pages=pages,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


@router.get(
    "/{user_id}",
    response_model=UserProfile,
    summary="Get user by ID",
    description="Get specific user information by ID."
)
async def get_user_by_id(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get specific user information by ID.
    
    - **user_id**: User ID to retrieve
    
    Users can only access their own profile unless they are admin.
    Returns detailed user profile information.
    """
    try:
        # Check if user is requesting their own profile or is admin
        if user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only access your own profile."
            )
        
        auth_service = AuthService(session)
        user = await auth_service.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Convert to profile response
        user_profile = UserProfile.model_validate(user)
        
        # Add additional statistics if needed
        # TODO: Add dataset and visualization counts from relationships
        user_profile.datasets_count = len(user.datasets) if user.datasets else 0
        
        return user_profile
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )


@router.put(
    "/{user_id}/activate",
    response_model=UserResponse,
    summary="Activate user",
    description="Activate a user account (admin only)."
)
async def activate_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Activate a user account (admin only).
    
    - **user_id**: User ID to activate
    
    Activates the specified user account, allowing them to login.
    """
    try:
        auth_service = AuthService(session)
        user = await auth_service.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user.activate()
        await session.commit()
        
        return UserResponse.model_validate(user)
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate user"
        )


@router.put(
    "/{user_id}/deactivate",
    response_model=UserResponse,
    summary="Deactivate user",
    description="Deactivate a user account (admin only)."
)
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Deactivate a user account (admin only).
    
    - **user_id**: User ID to deactivate
    
    Deactivates the specified user account, preventing login.
    Existing sessions may still be valid until they expire.
    """
    try:
        # Prevent admin from deactivating themselves
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account"
            )
        
        auth_service = AuthService(session)
        user = await auth_service.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user.deactivate()
        
        # Also logout user from all sessions
        await auth_service.logout_user(user_id, all_sessions=True)
        
        await session.commit()
        
        return UserResponse.model_validate(user)
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate user"
        )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user",
    description="Permanently delete a user account (admin only)."
)
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Permanently delete a user account (admin only).
    
    - **user_id**: User ID to delete
    
    **WARNING**: This permanently deletes the user and all associated data.
    This action cannot be undone.
    """
    try:
        # Prevent admin from deleting themselves
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your own account"
            )
        
        auth_service = AuthService(session)
        user = await auth_service.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Delete user (cascading will handle datasets, sessions, etc.)
        await session.delete(user)
        await session.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )


@router.get(
    "/{user_id}/stats",
    summary="Get user statistics",
    description="Get statistics for a specific user."
)
async def get_user_stats(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Get statistics for a specific user.
    
    - **user_id**: User ID to get stats for
    
    Users can only access their own stats unless they are admin.
    Returns various user activity statistics.
    """
    try:
        # Check permissions
        if user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only access your own statistics."
            )
        
        auth_service = AuthService(session)
        user = await auth_service.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # TODO: Calculate actual statistics from related models
        stats = {
            "user_id": user_id,
            "datasets_count": 0,
            "visualizations_count": 0,
            "total_processing_time": 0.0,
            "most_used_algorithms": [],
            "account_age_days": (user.created_at - user.created_at).days if user.created_at else 0,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "login_count": user.login_count,
        }
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user statistics"
        )