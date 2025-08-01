"""
Security utilities for authentication, password hashing, and JWT tokens.
Provides comprehensive security features for the FastAPI application.
"""

import secrets
from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.hash import bcrypt
from pydantic import BaseModel

from .config import settings


class TokenData(BaseModel):
    """Token payload data model."""
    user_id: str
    email: str
    token_type: str = "access"
    exp: Optional[datetime] = None
    iat: Optional[datetime] = None


# TokenResponse moved to schemas/user.py to avoid duplication


# Password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)


class SecurityError(Exception):
    """Base security exception."""
    pass


class TokenError(SecurityError):
    """Token-related errors."""
    pass


class PasswordError(SecurityError):
    """Password-related errors."""
    pass


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
        
    Raises:
        PasswordError: If password is too weak or hashing fails
    """
    if not password or len(password.strip()) < 8:
        raise PasswordError("Password must be at least 8 characters long")
    
    try:
        return pwd_context.hash(password)
    except Exception as e:
        raise PasswordError(f"Failed to hash password: {str(e)}")


def validate_password_strength(password: str) -> bool:
    """
    Validate password strength requirements.
    
    Args:
        password: Plain text password
        
    Returns:
        True if password meets requirements
        
    Raises:
        PasswordError: If password doesn't meet requirements
    """
    if not password:
        raise PasswordError("Password cannot be empty")
    
    if len(password) < 8:
        raise PasswordError("Password must be at least 8 characters long")
    
    if len(password) > 128:
        raise PasswordError("Password must be less than 128 characters")
    
    # Check for at least one number
    if not any(c.isdigit() for c in password):
        raise PasswordError("Password must contain at least one number")
    
    # Check for at least one letter
    if not any(c.isalpha() for c in password):
        raise PasswordError("Password must contain at least one letter")
    
    return True


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Token payload data
        expires_delta: Optional expiration time override
        
    Returns:
        Encoded JWT token string
        
    Raises:
        TokenError: If token creation fails
    """
    try:
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.security_settings.access_token_expire_minutes
            )
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "token_type": "access"
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.security_settings.secret_key,
            algorithm=settings.security_settings.algorithm
        )
        
        return encoded_jwt
        
    except Exception as e:
        raise TokenError(f"Failed to create access token: {str(e)}")


def create_refresh_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        data: Token payload data
        expires_delta: Optional expiration time override
        
    Returns:
        Encoded JWT refresh token string
        
    Raises:
        TokenError: If token creation fails
    """
    try:
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                days=settings.security_settings.refresh_token_expire_days
            )
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "token_type": "refresh"
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.security_settings.secret_key,
            algorithm=settings.security_settings.algorithm
        )
        
        return encoded_jwt
        
    except Exception as e:
        raise TokenError(f"Failed to create refresh token: {str(e)}")


def verify_token(token: str, token_type: str = "access") -> TokenData:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token string
        token_type: Expected token type ("access" or "refresh")
        
    Returns:
        Decoded token data
        
    Raises:
        TokenError: If token is invalid, expired, or wrong type
    """
    try:
        payload = jwt.decode(
            token,
            settings.security_settings.secret_key,
            algorithms=[settings.security_settings.algorithm]
        )
        
        # Verify token type
        if payload.get("token_type") != token_type:
            raise TokenError(f"Invalid token type. Expected {token_type}")
        
        # Extract required fields
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if not user_id or not email:
            raise TokenError("Token missing required fields")
        
        return TokenData(
            user_id=user_id,
            email=email,
            token_type=token_type,
            exp=datetime.fromtimestamp(payload.get("exp", 0)),
            iat=datetime.fromtimestamp(payload.get("iat", 0))
        )
        
    except JWTError as e:
        if "expired" in str(e).lower():
            raise TokenError("Token has expired")
        else:
            raise TokenError(f"Invalid token: {str(e)}")
    except Exception as e:
        raise TokenError(f"Token verification failed: {str(e)}")


def create_token_pair(user_id: str, email: str) -> dict:
    """
    Create both access and refresh tokens for a user.
    
    Args:
        user_id: User ID
        email: User email
        
    Returns:
        Dictionary with access_token, refresh_token, and expires_in
        
    Raises:
        TokenError: If token creation fails
    """
    try:
        token_data = {
            "sub": user_id,
            "email": email
        }
        
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": settings.security_settings.access_token_expire_minutes * 60
        }
        
    except Exception as e:
        raise TokenError(f"Failed to create token pair: {str(e)}")


def generate_reset_token() -> str:
    """
    Generate a secure random token for password reset.
    
    Returns:
        Random URL-safe token string
    """
    return secrets.token_urlsafe(32)


def generate_api_key() -> str:
    """
    Generate a secure API key.
    
    Returns:
        Random hex API key string
    """
    return secrets.token_hex(32)


def mask_email(email: str) -> str:
    """
    Mask email for privacy in logs.
    
    Args:
        email: Email address to mask
        
    Returns:
        Masked email string
    """
    if not email or "@" not in email:
        return "***"
    
    local, domain = email.split("@", 1)
    
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    
    return f"{masked_local}@{domain}"


def is_strong_password(password: str) -> tuple[bool, list[str]]:
    """
    Check password strength and return detailed feedback.
    
    Args:
        password: Password to check
        
    Returns:
        Tuple of (is_strong, list_of_issues)
    """
    issues = []
    
    if len(password) < 8:
        issues.append("Must be at least 8 characters long")
    
    if len(password) > 128:
        issues.append("Must be less than 128 characters")
    
    if not any(c.islower() for c in password):
        issues.append("Must contain at least one lowercase letter")
    
    if not any(c.isupper() for c in password):
        issues.append("Must contain at least one uppercase letter")
    
    if not any(c.isdigit() for c in password):
        issues.append("Must contain at least one number")
    
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        issues.append("Must contain at least one special character")
    
    return len(issues) == 0, issues