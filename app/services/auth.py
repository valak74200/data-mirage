"""
Authentication service for user management and JWT token handling.
Provides comprehensive authentication features including registration, login, password reset, etc.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    create_token_pair,
    generate_reset_token,
    validate_password_strength,
    SecurityError,
    PasswordError,
    TokenError,
)
from models.user import User
from models.session import Session
from schemas.user import (
    UserCreate,
    UserUpdate,
    TokenResponse,
    UserResponse,
    SessionResponse,
)
from core.config import settings


class AuthenticationError(Exception):
    """Authentication related errors."""
    pass


class UserExistsError(AuthenticationError):
    """User already exists error."""
    pass


class UserNotFoundError(AuthenticationError):
    """User not found error."""
    pass


class InvalidCredentialsError(AuthenticationError):
    """Invalid credentials error."""
    pass


class AccountDisabledError(AuthenticationError):
    """Account disabled error."""
    pass


class AuthService:
    """
    Authentication service providing user management and security features.
    
    Features:
    - User registration and profile management
    - Password authentication and hashing
    - JWT token generation and validation
    - Session management
    - Password reset functionality
    - Email verification
    - Account activation/deactivation
    """
    
    def __init__(self, session: AsyncSession):
        """
        Initialize authentication service.
        
        Args:
            session: Database session
        """
        self.session = session
    
    async def register_user(
        self,
        user_data: UserCreate,
        device_info: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> TokenResponse:
        """
        Register a new user and create initial session.
        
        Args:
            user_data: User registration data
            device_info: Device information for session tracking
            ip_address: User's IP address
            user_agent: User's browser/client info
            
        Returns:
            Token response with access and refresh tokens
            
        Raises:
            UserExistsError: If user with email already exists
            PasswordError: If password doesn't meet requirements
            SecurityError: If registration fails for security reasons
        """
        # Check if passwords match
        if user_data.password != user_data.confirm_password:
            raise PasswordError("Passwords do not match")
        
        # Validate password strength
        validate_password_strength(user_data.password)
        
        # Check if user already exists
        existing_user = await self.get_user_by_email(user_data.email)
        if existing_user:
            raise UserExistsError(f"User with email {user_data.email} already exists")
        
        try:
            # Hash password
            hashed_password = get_password_hash(user_data.password)
            
            # Create user
            user = User(
                id=str(uuid.uuid4()),
                email=user_data.email,
                hashed_password=hashed_password,
                first_name=user_data.first_name,
                last_name=user_data.last_name,
                profile_image_url=user_data.profile_image_url,
                is_active=True,
                email_verified=False,  # Will be verified via email
            )
            
            self.session.add(user)
            await self.session.flush()  # Get the user ID
            
            # Create initial session
            session_data = await self._create_user_session(
                user,
                device_info=device_info,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            
            # Generate tokens
            access_token = create_access_token({"sub": user.id, "email": user.email})
            refresh_token = create_refresh_token({"sub": user.id, "email": user.email})
            
            # Create complete token response
            token_response = TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_in=settings.security_settings.access_token_expire_minutes * 60,
                user=UserResponse.model_validate(user)
            )
            
            await self.session.commit()
            
            return token_response
            
        except Exception as e:
            await self.session.rollback()
            if isinstance(e, (PasswordError, SecurityError)):
                raise
            raise SecurityError(f"Registration failed: {str(e)}")
    
    async def authenticate_user(
        self,
        email: str,
        password: str,
        device_info: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        remember_me: bool = False,
    ) -> TokenResponse:
        """
        Authenticate user with email and password.
        
        Args:
            email: User's email address
            password: User's password
            device_info: Device information for session tracking
            ip_address: User's IP address
            user_agent: User's browser/client info
            remember_me: Whether to extend session duration
            
        Returns:
            Token response with access and refresh tokens
            
        Raises:
            InvalidCredentialsError: If credentials are invalid
            AccountDisabledError: If account is disabled
            AuthenticationError: If authentication fails
        """
        try:
            # Get user by email
            user = await self.get_user_by_email(email)
            if not user:
                raise InvalidCredentialsError("Invalid email or password")
            
            # Verify password
            if not verify_password(password, user.hashed_password):
                raise InvalidCredentialsError("Invalid email or password")
            
            # Check if account is active
            if not user.is_active:
                raise AccountDisabledError("Account is disabled")
            
            # Update login information
            user.update_last_login()
            
            # Create session
            session_data = await self._create_user_session(
                user,
                device_info=device_info,
                ip_address=ip_address,
                user_agent=user_agent,
                remember_me=remember_me,
            )
            
            # Generate tokens
            tokens = create_token_pair(user.id, user.email)
            token_response = TokenResponse(
                access_token=tokens["access_token"],
                refresh_token=tokens["refresh_token"],
                token_type="bearer",
                expires_in=tokens["expires_in"],
                user=UserResponse.model_validate(user)
            )
            
            await self.session.commit()
            
            return token_response
            
        except (InvalidCredentialsError, AccountDisabledError):
            raise
        except Exception as e:
            await self.session.rollback()
            raise AuthenticationError(f"Authentication failed: {str(e)}")
    
    async def refresh_access_token(
        self,
        refresh_token: str,
        device_info: Optional[Dict[str, Any]] = None,
    ) -> TokenResponse:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Valid refresh token
            device_info: Device information for validation
            
        Returns:
            New token response
            
        Raises:
            TokenError: If refresh token is invalid or expired
            UserNotFoundError: If associated user not found
        """
        try:
            # Find session with refresh token
            stmt = select(Session).where(
                Session.refresh_token == refresh_token,
                Session.is_active == True
            ).options(selectinload(Session.user))
            
            result = await self.session.execute(stmt)
            session_data = result.scalar_one_or_none()
            
            if not session_data or not session_data.is_valid:
                raise TokenError("Invalid or expired refresh token")
            
            user = session_data.user
            if not user or not user.is_active:
                raise UserNotFoundError("Associated user not found or inactive")
            
            # Update session last used
            session_data.update_last_used()
            
            # Generate new tokens
            tokens = create_token_pair(user.id, user.email)
            token_response = TokenResponse(
                access_token=tokens["access_token"],
                refresh_token=tokens["refresh_token"],
                token_type="bearer",
                expires_in=tokens["expires_in"],
                user=UserResponse.model_validate(user)
            )
            
            await self.session.commit()
            
            return token_response
            
        except (TokenError, UserNotFoundError):
            raise
        except Exception as e:
            await self.session.rollback()
            raise TokenError(f"Token refresh failed: {str(e)}")
    
    async def logout_user(
        self,
        user_id: str,
        session_id: Optional[str] = None,
        all_sessions: bool = False,
    ) -> bool:
        """
        Logout user by revoking sessions.
        
        Args:
            user_id: User ID
            session_id: Specific session to revoke (optional)
            all_sessions: Whether to revoke all user sessions
            
        Returns:
            True if logout successful
        """
        try:
            if all_sessions:
                # Revoke all user sessions
                stmt = update(Session).where(
                    Session.user_id == user_id,
                    Session.is_active == True
                ).values(
                    is_active=False,
                    revoked_at=datetime.utcnow()
                )
            elif session_id:
                # Revoke specific session
                stmt = update(Session).where(
                    Session.id == session_id,
                    Session.user_id == user_id,
                    Session.is_active == True
                ).values(
                    is_active=False,
                    revoked_at=datetime.utcnow()
                )
            else:
                # This shouldn't happen, but handle gracefully
                return False
            
            result = await self.session.execute(stmt)
            await self.session.commit()
            
            return result.rowcount > 0
            
        except Exception as e:
            await self.session.rollback()
            raise AuthenticationError(f"Logout failed: {str(e)}")
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Get user by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            User object if found, None otherwise
        """
        try:
            stmt = select(User).where(User.id == user_id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except Exception:
            return None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email address.
        
        Args:
            email: Email address
            
        Returns:
            User object if found, None otherwise
        """
        try:
            stmt = select(User).where(User.email == email)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except Exception:
            return None
    
    async def update_user_profile(
        self,
        user_id: str,
        update_data: UserUpdate,
    ) -> Optional[User]:
        """
        Update user profile information.
        
        Args:
            user_id: User ID
            update_data: Profile update data
            
        Returns:
            Updated user object
            
        Raises:
            UserNotFoundError: If user not found
        """
        try:
            user = await self.get_user_by_id(user_id)
            if not user:
                raise UserNotFoundError("User not found")
            
            # Update fields
            update_fields = update_data.model_dump(exclude_unset=True)
            for field, value in update_fields.items():
                setattr(user, field, value)
            
            await self.session.commit()
            return user
            
        except UserNotFoundError:
            raise
        except Exception as e:
            await self.session.rollback()
            raise AuthenticationError(f"Profile update failed: {str(e)}")
    
    async def change_password(
        self,
        user_id: str,
        current_password: str,
        new_password: str,
        revoke_other_sessions: bool = True,
    ) -> bool:
        """
        Change user password.
        
        Args:
            user_id: User ID
            current_password: Current password
            new_password: New password
            revoke_other_sessions: Whether to revoke other sessions
            
        Returns:
            True if password changed successfully
            
        Raises:
            UserNotFoundError: If user not found
            InvalidCredentialsError: If current password is wrong
            PasswordError: If new password doesn't meet requirements
        """
        try:
            user = await self.get_user_by_id(user_id)
            if not user:
                raise UserNotFoundError("User not found")
            
            # Verify current password
            if not verify_password(current_password, user.hashed_password):
                raise InvalidCredentialsError("Current password is incorrect")
            
            # Validate new password
            validate_password_strength(new_password)
            
            # Update password
            user.hashed_password = get_password_hash(new_password)
            
            # Optionally revoke other sessions
            if revoke_other_sessions:
                await self.logout_user(user_id, all_sessions=True)
            
            await self.session.commit()
            return True
            
        except (UserNotFoundError, InvalidCredentialsError, PasswordError):
            raise
        except Exception as e:
            await self.session.rollback()
            raise AuthenticationError(f"Password change failed: {str(e)}")
    
    async def get_user_sessions(self, user_id: str) -> List[SessionResponse]:
        """
        Get all active sessions for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            List of active sessions
        """
        try:
            stmt = select(Session).where(
                Session.user_id == user_id,
                Session.is_active == True
            ).order_by(Session.last_used.desc())
            
            result = await self.session.execute(stmt)
            sessions = result.scalars().all()
            
            return [SessionResponse.model_validate(s) for s in sessions]
            
        except Exception:
            return []
    
    async def _create_user_session(
        self,
        user: User,
        device_info: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        remember_me: bool = False,
    ) -> Session:
        """
        Create a new user session.
        
        Args:
            user: User object
            device_info: Device information
            ip_address: IP address
            user_agent: User agent string
            remember_me: Whether to extend session duration
            
        Returns:
            Created session object
        """
        # Generate refresh token
        refresh_token = generate_reset_token()
        
        # Set expiration
        expires_days = 30 if remember_me else 7
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        # Create session
        session_data = Session(
            id=str(uuid.uuid4()),
            user_id=user.id,
            refresh_token=refresh_token,
            device_info=device_info,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=expires_at,
        )
        
        self.session.add(session_data)
        return session_data
    
    async def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions.
        
        Returns:
            Number of sessions cleaned up
        """
        try:
            stmt = update(Session).where(
                Session.expires_at < datetime.utcnow(),
                Session.is_active == True
            ).values(
                is_active=False,
                revoked_at=datetime.utcnow()
            )
            
            result = await self.session.execute(stmt)
            await self.session.commit()
            
            return result.rowcount
            
        except Exception:
            await self.session.rollback()
            return 0