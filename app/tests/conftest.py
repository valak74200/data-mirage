"""
Test configuration and fixtures for Data Mirage tests.
"""

import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from ..main import app
from core.database import Base, get_async_session
from core.config import settings
from models.user import User
from models.dataset import Dataset
from services.auth import AuthService


# Test database URL (SQLite in memory for tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Clean up
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncSession:
    """Create test database session."""
    TestSessionLocal = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture
def override_get_db(test_session):
    """Override database dependency for tests."""
    async def _override_get_db():
        yield test_session
    
    app.dependency_overrides[get_async_session] = _override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def test_client(override_get_db):
    """Create test client."""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client(override_get_db) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def test_user(test_session: AsyncSession) -> User:
    """Create test user."""
    from core.security import get_password_hash
    
    user = User(
        id="test-user-id",
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
        first_name="Test",
        last_name="User",
        is_active=True,
        email_verified=True,
    )
    
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    
    return user


@pytest_asyncio.fixture
async def test_admin_user(test_session: AsyncSession) -> User:
    """Create test admin user."""
    from core.security import get_password_hash
    
    user = User(
        id="test-admin-id",
        email="admin@example.com",
        hashed_password=get_password_hash("adminpassword123"),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_admin=True,
        email_verified=True,
    )
    
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    
    return user


@pytest_asyncio.fixture
async def test_dataset(test_session: AsyncSession, test_user: User) -> Dataset:
    """Create test dataset."""
    dataset = Dataset(
        id="test-dataset-id",
        name="Test Dataset",
        description="A test dataset",
        original_data=[
            {"x": 1, "y": 2, "label": "A"},
            {"x": 2, "y": 3, "label": "B"},
            {"x": 3, "y": 4, "label": "A"},
            {"x": 4, "y": 5, "label": "B"},
        ],
        user_id=test_user.id,
        status="uploaded",
        dataset_metadata={},  # Initialize empty metadata dictionary
        file_info={
            "filename": "test_data.csv",
            "size": 1024,
            "mime_type": "text/csv",
        }
    )
    
    dataset.update_metadata()
    
    test_session.add(dataset)
    await test_session.commit()
    await test_session.refresh(dataset)
    
    return dataset


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    """Create authentication headers for test user."""
    from core.security import create_access_token
    
    token = create_access_token({"sub": test_user.id, "email": test_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_auth_headers(test_admin_user: User) -> dict:
    """Create authentication headers for admin user."""
    from core.security import create_access_token
    
    token = create_access_token({"sub": test_admin_user.id, "email": test_admin_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_csv_data():
    """Sample CSV data for testing."""
    return """name,age,city,salary
John,25,New York,50000
Jane,30,San Francisco,75000
Bob,35,Chicago,60000
Alice,28,Boston,65000"""


@pytest.fixture
def sample_json_data():
    """Sample JSON data for testing."""
    return [
        {"name": "John", "age": 25, "city": "New York", "salary": 50000},
        {"name": "Jane", "age": 30, "city": "San Francisco", "salary": 75000},
        {"name": "Bob", "age": 35, "city": "Chicago", "salary": 60000},
        {"name": "Alice", "age": 28, "city": "Boston", "salary": 65000},
    ]