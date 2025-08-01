"""
Tests for main application endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient


class TestMainEndpoints:
    """Test main application endpoints."""
    
    def test_root_endpoint(self, test_client: TestClient):
        """Test root endpoint."""
        response = test_client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "api" in data
        assert data["version"] == "2.0.0"
    
    def test_health_check(self, test_client: TestClient):
        """Test health check endpoint."""
        response = test_client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Data Mirage API"
        assert data["version"] == "2.0.0"
    
    @pytest.mark.asyncio
    async def test_detailed_health_check(self, async_client: AsyncClient):
        """Test detailed health check endpoint."""
        response = await async_client.get("/health/detailed")
        assert response.status_code in [200, 503]  # May fail if DB not available
        
        data = response.json()
        assert "status" in data
        assert "components" in data
        assert "database" in data["components"]
        assert "websocket" in data["components"]
        assert "ml_services" in data["components"]


class TestErrorHandling:
    """Test error handling."""
    
    def test_404_endpoint(self, test_client: TestClient):
        """Test 404 error handling."""
        response = test_client.get("/nonexistent")
        assert response.status_code == 404
        
        data = response.json()
        assert "error" in data
        assert data["status_code"] == 404
    
    def test_cors_headers(self, test_client: TestClient):
        """Test CORS headers are present."""
        response = test_client.options("/", headers={"Origin": "http://localhost:3000"})
        assert "access-control-allow-origin" in response.headers