"""
Dependency injection utilities for FastAPI.
Provides common dependencies for authentication, database sessions, and services.
"""

import logging
from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from ratelimit import limits, sleep_and_retry
from ratelimit.exception import RateLimitException

from .database import get_async_session
from .security import verify_token, TokenError
from .config import settings
from models.user import User
from services.auth import AuthService
from services.ml_processor import MLProcessor
from services.rag_service import RAGService
from services.websocket import WebSocketManager

# Security scheme
security = HTTPBearer(auto_error=False)

# Redis connection
redis_client: Optional[redis.Redis] = None

# Logger
logger = logging.getLogger(__name__)


async def get_redis() -> redis.Redis:
    """Get Redis connection."""
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(
            settings.redis_settings.url,
            max_connections=settings.redis_settings.max_connections,
            decode_responses=settings.redis_settings.decode_responses,
        )
    return redis_client


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    """
    Get the current authenticated user.
    
    Args:
        credentials: JWT token from Authorization header
        session: Database session
        
    Returns:
        Current user object
        
    Raises:
        HTTPException: If authentication fails
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Verify token
        token_data = verify_token(credentials.credentials, "access")
        
        # Get user from database
        auth_service = AuthService(session)
        user = await auth_service.get_user_by_id(token_data.user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user
        
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get the current active user.
    
    Args:
        current_user: Current user from token
        
    Returns:
        Active user object
        
    Raises:
        HTTPException: If user is not active
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not active"
        )
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Get the current admin user.
    
    Args:
        current_user: Current active user
        
    Returns:
        Admin user object
        
    Raises:
        HTTPException: If user is not admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: AsyncSession = Depends(get_async_session),
) -> Optional[User]:
    """
    Get the current user if authenticated, otherwise None.
    
    Args:
        credentials: Optional JWT token
        session: Database session
        
    Returns:
        User object if authenticated, None otherwise
    """
    if not credentials:
        return None
    
    try:
        token_data = verify_token(credentials.credentials, "access")
        auth_service = AuthService(session)
        user = auth_service.get_user_by_id(token_data.user_id)
        return user if user and user.is_active else None
    except Exception:
        return None


# Service dependencies
async def get_auth_service(
    session: AsyncSession = Depends(get_async_session),
) -> AuthService:
    """Get authentication service."""
    return AuthService(session)


async def get_ml_processor(
    redis_conn: redis.Redis = Depends(get_redis),
) -> MLProcessor:
    """Get ML processor service."""
    return MLProcessor(redis_conn)


async def get_rag_service() -> RAGService:
    """Get RAG service."""
    return RAGService()


async def get_websocket_manager() -> WebSocketManager:
    """Get WebSocket manager."""
    # Use singleton pattern for WebSocket manager
    if not hasattr(get_websocket_manager, "_instance"):
        get_websocket_manager._instance = WebSocketManager()
    return get_websocket_manager._instance


# Rate limiting decorator
def rate_limit(calls: int = 100, period: int = 60):
    """
    Rate limiting decorator.
    
    Args:
        calls: Number of calls allowed
        period: Time period in seconds
    """
    def decorator(func):
        @sleep_and_retry
        @limits(calls=calls, period=period)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except RateLimitException:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )
        return wrapper
    return decorator


async def check_rate_limit(
    request: Request,
    redis_conn: redis.Redis = Depends(get_redis),
) -> None:
    """
    Check rate limit for requests.
    
    Args:
        request: FastAPI request object
        redis_conn: Redis connection
        
    Raises:
        HTTPException: If rate limit exceeded
    """
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Create rate limit key
    key = f"rate_limit:{client_ip}:{user_agent}"
    
    # Get current count
    current = await redis_conn.get(key)
    
    if current is None:
        # First request, set counter
        await redis_conn.setex(key, 60, 1)
    else:
        current_count = int(current)
        
        # Strict rate limiting - lower limits for security
        max_requests = 30  # Reduced from 100 to 30 per minute
        if current_count >= max_requests:
            # Log potential abuse
            logger.warning(f"Rate limit exceeded for IP {client_ip} - {current_count} requests")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per minute.",
                headers={"Retry-After": "60"}
            )
        
        # Increment counter
        await redis_conn.incr(key)


async def validate_file_upload(
    file_size: int,
    file_type: str,
    file_content: bytes = None,
    filename: str = None,
) -> None:
    """
    Comprehensive file upload validation with security checks.
    
    Args:
        file_size: Size of uploaded file in bytes
        file_type: MIME type of uploaded file
        file_content: Optional file content for magic number validation
        filename: Optional filename for extension validation
        
    Raises:
        HTTPException: If file validation fails
    """
    # Check file size (strict limits)
    if file_size > settings.max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.max_file_size // (1024*1024)}MB"
        )
    
    # Minimum file size check (prevent empty files)
    if file_size < 10:  # At least 10 bytes
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too small or empty"
        )
    
    # Strict MIME type validation
    allowed_types = {
        "text/csv": [".csv"],
        "application/json": [".json"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
    }
    
    if file_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file_type}. Allowed: {list(allowed_types.keys())}"
        )
    
    # Validate file extension matches MIME type
    if filename:
        filename_lower = filename.lower()
        expected_extensions = allowed_types[file_type]
        
        if not any(filename_lower.endswith(ext) for ext in expected_extensions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension doesn't match MIME type. Expected: {expected_extensions}"
            )
        
        # Block dangerous filenames
        dangerous_patterns = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
        if any(pattern in filename for pattern in dangerous_patterns):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename contains dangerous characters"
            )
    
    # Magic number validation if content provided
    if file_content:
        await _validate_file_magic_numbers(file_content, file_type)


async def _validate_file_magic_numbers(content: bytes, expected_mime: str) -> None:
    """
    Validate file content using magic numbers.
    
    Args:
        content: File content bytes
        expected_mime: Expected MIME type
        
    Raises:
        HTTPException: If magic numbers don't match expected type
    """
    if len(content) < 4:
        return  # Too small to validate
    
    # Magic number signatures
    magic_numbers = {
        "text/csv": None,  # CSV has no specific magic number
        "application/json": None,  # JSON has no specific magic number
        "application/vnd.ms-excel": [b'\xd0\xcf\x11\xe0', b'\x09\x08\x06\x00'],  # XLS
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [b'PK\x03\x04']  # XLSX (ZIP)
    }
    
    expected_signatures = magic_numbers.get(expected_mime)
    if expected_signatures is None:
        return  # No magic number check for this type
    
    # Check if content starts with any expected signature
    content_start = content[:8]  # Check first 8 bytes
    
    if not any(content_start.startswith(sig) for sig in expected_signatures):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content doesn't match the declared file type"
        )


class PaginationParams:
    """Pagination parameters."""
    
    def __init__(
        self,
        skip: int = 0,
        limit: int = 100,
    ):
        self.skip = max(0, skip)
        self.limit = min(limit, 1000)  # Max 1000 items per page


def get_pagination_params(
    skip: int = 0,
    limit: int = 100,
) -> PaginationParams:
    """Get pagination parameters."""
    return PaginationParams(skip=skip, limit=limit)


class FilterParams:
    """Filtering parameters."""
    
    def __init__(
        self,
        search: Optional[str] = None,
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
    ):
        self.search = search.strip() if search else None
        self.created_after = created_after
        self.created_before = created_before


def get_filter_params(
    search: Optional[str] = None,
    created_after: Optional[str] = None,
    created_before: Optional[str] = None,
) -> FilterParams:
    """Get filtering parameters."""
    return FilterParams(
        search=search,
        created_after=created_after,
        created_before=created_before,
    )