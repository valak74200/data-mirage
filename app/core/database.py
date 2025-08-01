"""
Database configuration and session management for SQLAlchemy.
Provides async database connections and session management.
"""

import logging
from typing import AsyncGenerator
from sqlalchemy import create_engine, MetaData, event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from .config import settings

# Configure logging
logger = logging.getLogger(__name__)

# SQLAlchemy metadata and base
metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s"
    }
)

Base = declarative_base(metadata=metadata)

# Database engines
async_engine: AsyncEngine = None
sync_engine = None

# Session makers
AsyncSessionLocal: async_sessionmaker[AsyncSession] = None
SessionLocal = None


def create_database_engines():
    """Create database engines for async and sync operations."""
    global async_engine, sync_engine, AsyncSessionLocal, SessionLocal
    
    database_settings = settings.database_settings
    
    # Create async engine
    async_engine = create_async_engine(
        database_settings.url,
        echo=database_settings.echo,
        pool_size=database_settings.pool_size,
        max_overflow=database_settings.max_overflow,
        pool_pre_ping=database_settings.pool_pre_ping,
        # Connection pool settings for better performance
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_timeout=30,    # Timeout after 30 seconds
    )
    
    # Create sync engine for migrations
    sync_url = database_settings.url.replace("+asyncpg", "")
    sync_engine = create_engine(
        sync_url,
        echo=database_settings.echo,
        pool_size=database_settings.pool_size,
        max_overflow=database_settings.max_overflow,
        pool_pre_ping=database_settings.pool_pre_ping,
        pool_recycle=3600,
        pool_timeout=30,
    )
    
    # Create session makers
    AsyncSessionLocal = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=True,
        autocommit=False,
    )
    
    SessionLocal = sessionmaker(
        bind=sync_engine,
        autoflush=True,
        autocommit=False,
    )
    
    # Add connection event listeners
    @event.listens_for(async_engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        """Set SQLite pragmas if using SQLite."""
        if "sqlite" in database_settings.url:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA cache_size=1000")
            cursor.execute("PRAGMA temp_store=memory")
            cursor.close()
    
    @event.listens_for(async_engine.sync_engine, "checkout")
    def ping_connection(dbapi_connection, connection_record, connection_proxy):
        """Ping connection on checkout to ensure it's alive."""
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
        except Exception:
            # Connection is dead, invalidate it
            connection_proxy._pool.invalidate(dbapi_connection)
            raise
    
    logger.info("Database engines created successfully")


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get async database session.
    
    Yields:
        AsyncSession: Database session
        
    Raises:
        DatabaseError: If session creation fails
    """
    if AsyncSessionLocal is None:
        create_database_engines()
    
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            await session.close()


def get_sync_session():
    """
    Get synchronous database session for migrations.
    
    Returns:
        Session: Database session
    """
    if SessionLocal is None:
        create_database_engines()
    
    return SessionLocal()


async def init_database():
    """Initialize database tables."""
    try:
        # Import all models to ensure they're registered
        from models import user, dataset, session as session_model
        
        # Create all tables
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database tables created successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise


async def close_database():
    """Close database connections."""
    if async_engine:
        await async_engine.dispose()
        logger.info("Database connections closed")


class DatabaseError(Exception):
    """Base database exception."""
    pass


class ConnectionError(DatabaseError):
    """Database connection errors."""
    pass


class TransactionError(DatabaseError):
    """Database transaction errors."""
    pass


async def check_database_connection() -> bool:
    """
    Check if database connection is working.
    
    Returns:
        True if connection is successful, False otherwise
    """
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database connection check failed: {str(e)}")
        return False


async def get_database_info() -> dict:
    """
    Get database information for health checks.
    
    Returns:
        Dictionary with database info
    """
    try:
        async with AsyncSessionLocal() as session:
            # Get database version
            result = await session.execute("SELECT version()")
            version = result.scalar()
            
            return {
                "status": "connected",
                "version": version,
                "url": settings.database_url.split("@")[-1],  # Hide credentials
                "pool_size": settings.database_settings.pool_size,
                "echo": settings.database_settings.echo,
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "url": settings.database_url.split("@")[-1],
        }


# Initialize engines on import
create_database_engines()