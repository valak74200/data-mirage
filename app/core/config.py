"""
Configuration module for Data Mirage FastAPI application.
Handles environment variables, database settings, and security configuration.
"""

import os
import hashlib
import base64
from typing import List, Union
from pydantic import BaseModel, validator, ConfigDict
from pydantic_settings import BaseSettings


class DatabaseSettings(BaseModel):
    """Database configuration settings."""
    
    url: str
    echo: bool = False
    pool_size: int = 10
    max_overflow: int = 20
    pool_pre_ping: bool = True
    
    model_config = ConfigDict(extra="forbid")


class SecuritySettings(BaseModel):
    """Security and authentication settings."""
    
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    password_reset_expire_minutes: int = 15
    
    model_config = ConfigDict(extra="forbid")


class RedisSettings(BaseModel):
    """Redis configuration for caching and session storage."""
    
    url: str = "redis://localhost:6379"
    max_connections: int = 20
    decode_responses: bool = True
    
    model_config = ConfigDict(extra="forbid")


class CORSSettings(BaseModel):
    """CORS configuration settings."""
    
    allow_origins: List[str] = ["http://localhost:3000", "http://localhost:5000"]
    allow_credentials: bool = True
    allow_methods: List[str] = ["*"]
    allow_headers: List[str] = ["*"]
    
    model_config = ConfigDict(extra="forbid")


class RateLimitSettings(BaseModel):
    """Rate limiting configuration."""
    
    requests_per_minute: int = 30  # Stricter rate limiting
    burst_size: int = 50  # Lower burst tolerance
    upload_requests_per_hour: int = 10  # Special limit for uploads
    
    model_config = ConfigDict(extra="forbid")


class MLSettings(BaseModel):
    """Machine Learning processing settings."""
    
    max_dataset_size: int = 1000000  # Max rows
    max_file_size_mb: int = 100
    default_tsne_perplexity: float = 30.0
    default_umap_neighbors: int = 15
    max_clusters: int = 20
    processing_timeout_seconds: int = 300
    
    model_config = ConfigDict(extra="forbid")


class RAGSettings(BaseModel):
    """RAG service configuration."""
    
    openai_api_key: str
    model: str = "gpt-3.5-turbo"
    max_tokens: int = 500
    temperature: float = 0.3
    max_retries: int = 3
    
    model_config = ConfigDict(extra="forbid")


class Settings(BaseSettings):
    """Main application settings."""
    
    # App info
    app_name: str = "Data Mirage API"
    version: str = "2.0.0"
    description: str = "Advanced 3D data visualization with ML processing"
    debug: bool = False
    
    # Environment
    environment: str = "development"
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False
    
    # Database
    database_url: str
    
    # Security
    secret_key: str
    
    # External APIs
    openai_api_key: str = ""
    
    # Redis URL
    redis_url: str = "redis://localhost:6379"
    
    # File upload settings
    upload_dir: str = "./uploads"
    max_file_size: int = 100 * 1024 * 1024  # 100MB
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    @validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate database URL format."""
        if not v:
            raise ValueError("DATABASE_URL is required")
        
        # Allow SQLite in development mode
        if v.startswith("sqlite://"):
            return v
        
        # Handle PostgreSQL URLs
        if not v.startswith(("postgresql://", "postgresql+asyncpg://")):
            # Convert to asyncpg format if needed
            if v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            else:
                raise ValueError("DATABASE_URL must be a valid SQLite or PostgreSQL URL")
        return v
    
    @validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Validate secret key strength with enhanced security."""
        if not v:
            raise ValueError("SECRET_KEY is required")
        if len(v) < 64:  # Increased from 32 to 64 characters
            raise ValueError("SECRET_KEY must be at least 64 characters long")
        
        # Check for common weak patterns
        if v.lower() in ["secret", "password", "key", "token"]:
            raise ValueError("SECRET_KEY must not be a common word")
        
        # Ensure sufficient entropy
        if len(set(v)) < 20:  # At least 20 unique characters
            raise ValueError("SECRET_KEY must have sufficient entropy (at least 20 unique characters)")
        
        # Check for repeated patterns
        if any(v[i:i+3] == v[i+3:i+6] for i in range(len(v)-5)):
            raise ValueError("SECRET_KEY must not contain repeated patterns")
        
        return v
    
    @validator("openai_api_key")
    @classmethod
    def validate_openai_key(cls, v: str) -> str:
        """Validate OpenAI API key format."""
        if v and not v.startswith("sk-"):
            raise ValueError("Invalid OpenAI API key format")
        return v
    
    @property
    def database_settings(self) -> DatabaseSettings:
        """Get database settings."""
        return DatabaseSettings(
            url=self.database_url,
            echo=self.debug,
        )
    
    @property
    def security_settings(self) -> SecuritySettings:
        """Get security settings."""
        return SecuritySettings(
            secret_key=self.secret_key,
        )
    
    @property
    def redis_settings(self) -> RedisSettings:
        """Get Redis settings."""
        return RedisSettings(
            url=self.redis_url,
        )
    
    @property
    def cors_settings(self) -> CORSSettings:
        """Get CORS settings."""
        origins = [
            "http://localhost:3000", 
            "http://localhost:5000", 
            "http://localhost:5173",  # Vite default port
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173"
        ]
        if self.environment == "production":
            # Add production domains here
            origins.extend([])
        
        return CORSSettings(
            allow_origins=origins,
        )
    
    @property
    def rate_limit_settings(self) -> RateLimitSettings:
        """Get rate limiting settings."""
        return RateLimitSettings()
    
    @property
    def ml_settings(self) -> MLSettings:
        """Get ML processing settings."""
        return MLSettings(
            max_file_size_mb=self.max_file_size // (1024 * 1024),
        )
    
    @property
    def rag_settings(self) -> RAGSettings:
        """Get RAG service settings."""
        return RAGSettings(
            openai_api_key=self.openai_api_key,
        )
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"
    
    def get_masked_database_url(self) -> str:
        """Get database URL with masked credentials for logging."""
        if "@" in self.database_url:
            parts = self.database_url.split("@")
            if len(parts) == 2:
                protocol_user = parts[0]
                host_db = parts[1]
                # Mask the password part
                if ":" in protocol_user:
                    protocol, user_pass = protocol_user.rsplit("://", 1)
                    if ":" in user_pass:
                        user, _ = user_pass.split(":", 1)
                        return f"{protocol}://{user}:***@{host_db}"
        return "***"
    
    def get_masked_openai_key(self) -> str:
        """Get masked OpenAI API key for logging."""
        if not self.openai_api_key:
            return "not configured"
        return f"{self.openai_api_key[:8]}***{self.openai_api_key[-4:]}"
    
    def validate_security_configuration(self) -> dict:
        """Validate and return security configuration status."""
        checks = {
            "secret_key_strength": len(self.secret_key) >= 64,
            "database_url_secure": self.database_url.startswith(("postgresql://", "postgresql+asyncpg://")),
            "openai_key_configured": bool(self.openai_api_key),
            "production_ready": self.is_production and len(self.secret_key) >= 64,
        }
        return checks


# Global settings instance
settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)