"""
Security middleware for additional protection layers.
"""

import re
import logging
from typing import Dict, Set
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.
    """
    
    def __init__(self, app, csp_policy: str = None):
        super().__init__(app)
        self.csp_policy = csp_policy or (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https:; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none'"
        )
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = self.csp_policy
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Remove server header
        if "Server" in response.headers:
            del response.headers["Server"]
        
        return response


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """
    Sanitize and validate input data for common attack patterns.
    """
    
    SUSPICIOUS_PATTERNS = [
        # SQL Injection patterns
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)",
        r"(\bunion\b.*\bselect\b)",
        r"(\bor\b.*\b1\s*=\s*1\b)",
        
        # XSS patterns
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        
        # Path traversal
        r"\.\./",
        r"\.\.\\",
        
        # Command injection
        r"[;&|`$()]",
        
        # Template injection
        r"\{\{.*\}\}",
        r"\{%.*%\}",
    ]
    
    def __init__(self, app):
        super().__init__(app)
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.SUSPICIOUS_PATTERNS]
    
    async def dispatch(self, request: Request, call_next):
        # Check URL path
        if self._is_suspicious(request.url.path):
            logger.warning(f"Suspicious URL path detected: {request.url.path}")
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid request"}
            )
        
        # Check query parameters
        for param, value in request.query_params.items():
            if self._is_suspicious(f"{param}={value}"):
                logger.warning(f"Suspicious query parameter: {param}={value}")
                return JSONResponse(
                    status_code=400,
                    content={"error": "Invalid request parameters"}
                )
        
        return await call_next(request)
    
    def _is_suspicious(self, text: str) -> bool:
        """Check if text contains suspicious patterns."""
        return any(pattern.search(text) for pattern in self.compiled_patterns)


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """
    IP-based access control middleware.
    """
    
    def __init__(self, app, allowed_ips: Set[str] = None, admin_ips: Set[str] = None):
        super().__init__(app)
        self.allowed_ips = allowed_ips or set()
        self.admin_ips = admin_ips or set()
    
    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        
        # Check if accessing admin endpoints
        if request.url.path.startswith("/admin"):
            if client_ip not in self.admin_ips:
                logger.warning(f"Unauthorized admin access attempt from {client_ip}")
                return JSONResponse(
                    status_code=403,
                    content={"error": "Access denied"}
                )
        
        # General IP whitelist (if configured)
        if self.allowed_ips and client_ip not in self.allowed_ips:
            logger.warning(f"IP not whitelisted: {client_ip}")
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied"}
            )
        
        return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP with proxy header support."""
        # Check for forwarded IP headers (be careful with these in production)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """
    Limit request body size to prevent DoS attacks.
    """
    
    def __init__(self, app, max_size: int = 10 * 1024 * 1024):  # 10MB default
        super().__init__(app)
        self.max_size = max_size
    
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        
        if content_length:
            if int(content_length) > self.max_size:
                logger.warning(f"Request too large: {content_length} bytes")
                return JSONResponse(
                    status_code=413,
                    content={"error": "Request too large"}
                )
        
        return await call_next(request)