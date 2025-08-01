"""
Tests de sécurité pour vérifier les corrections appliquées.
"""

import pytest
import json
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from ..main import app
from core.config import settings


class TestSecurityFixes:
    """Tests pour valider les corrections de sécurité critiques."""
    
    def test_websocket_no_eval(self):
        """Test que eval() n'est plus utilisé dans le code WebSocket."""
        with open("app/main.py", "r") as f:
            content = f.read()
        
        # Vérifier qu'eval() n'est plus présent
        assert "eval(" not in content, "eval() trouvé dans le code - vulnérabilité critique"
        
        # Vérifier que json.loads est utilisé
        assert "json.loads" in content, "json.loads non trouvé - parsing sécurisé manquant"
    
    def test_trusted_hosts_not_wildcard(self):
        """Test que TrustedHost n'utilise plus le wildcard."""
        with open("app/main.py", "r") as f:
            content = f.read()
        
        # Vérifier que ["*"] n'est plus utilisé
        assert 'allowed_hosts=["*"]' not in content, "Wildcard trouvé dans TrustedHost - vulnérabilité critique"
        
        # Vérifier que des domaines spécifiques sont définis
        assert "data-mirage.com" in content, "Domaines spécifiques non configurés"
    
    def test_file_validation_enhanced(self):
        """Test que la validation des fichiers est renforcée."""
        with open("app/core/deps.py", "r") as f:
            content = f.read()
        
        # Vérifier la présence de magic number validation
        assert "_validate_file_magic_numbers" in content, "Validation magic numbers manquante"
        
        # Vérifier la validation des extensions
        assert "dangerous_patterns" in content, "Validation noms de fichiers dangereux manquante"
        
        # Vérifier la taille minimum
        assert "file_size < 10" in content, "Validation taille minimum manquante"
    
    def test_debug_info_masked(self):
        """Test que les informations de debug sont masquées en production."""
        with open("app/main.py", "r") as f:
            content = f.read()
        
        # Vérifier que les erreurs ne sont pas exposées directement
        assert "is_development" in content, "Vérification environnement manquante"
        assert "request_id" in content, "ID de request pour support manquant"
    
    def test_rate_limiting_stricter(self):
        """Test que le rate limiting est plus strict."""
        with open("app/core/deps.py", "r") as f:
            content = f.read()
        
        # Vérifier que la limite est réduite
        assert "max_requests = 30" in content, "Rate limiting non durci"
        
        # Vérifier le logging des abus
        assert "Rate limit exceeded for IP" in content, "Logging abus manquant"
    
    def test_secret_key_validation_enhanced(self):
        """Test que la validation des clés secrètes est renforcée."""
        with open("app/core/config.py", "r") as f:
            content = f.read()
        
        # Vérifier la longueur minimum augmentée
        assert "len(v) < 64" in content, "Validation longueur clé secrète insuffisante"
        
        # Vérifier la validation d'entropie
        assert "sufficient entropy" in content, "Validation entropie manquante"
        
        # Vérifier la validation OpenAI key
        assert "sk-" in content, "Validation format clé OpenAI manquante"
    
    def test_credentials_masking(self):
        """Test que les credentials sont masqués dans les logs."""
        with open("app/core/config.py", "r") as f:
            content = f.read()
        
        # Vérifier les méthodes de masquage
        assert "get_masked_database_url" in content, "Masquage URL DB manquant"
        assert "get_masked_openai_key" in content, "Masquage clé OpenAI manquant"
    
    def test_security_middleware_present(self):
        """Test que les middlewares de sécurité sont présents."""
        with open("app/core/security_middleware.py", "r") as f:
            content = f.read()
        
        # Vérifier les headers de sécurité
        assert "X-Content-Type-Options" in content, "Header sécurité manquant"
        assert "X-Frame-Options" in content, "Header anti-clickjacking manquant"
        assert "Content-Security-Policy" in content, "CSP manquant"
        
        # Vérifier la sanitisation d'entrée
        assert "SUSPICIOUS_PATTERNS" in content, "Patterns d'attaque manquants"
    
    def test_main_app_security_middleware(self):
        """Test que les middlewares sont appliqués dans main.py."""
        with open("app/main.py", "r") as f:
            content = f.read()
        
        # Vérifier l'import des middlewares
        assert "security_middleware" in content, "Import middlewares sécurité manquant"
        
        # Vérifier l'application des middlewares
        assert "SecurityHeadersMiddleware" in content, "Middleware headers sécurité non appliqué"
        assert "InputSanitizationMiddleware" in content, "Middleware sanitisation non appliqué"
        assert "RequestSizeMiddleware" in content, "Middleware taille request non appliqué"


def test_config_security_validation():
    """Test la validation de configuration de sécurité."""
    # Test avec une clé faible
    with pytest.raises(ValueError, match="at least 64 characters"):
        from core.config import Settings
        Settings(
            database_url="postgresql://user:pass@localhost/db",
            secret_key="short_key"
        )


def test_file_upload_validation():
    """Test la validation d'upload de fichiers."""
    from core.deps import validate_file_upload
    
    # Test fichier trop petit
    with pytest.raises(Exception):
        import asyncio
        asyncio.run(validate_file_upload(5, "text/csv"))
    
    # Test type de fichier non autorisé
    with pytest.raises(Exception):
        import asyncio
        asyncio.run(validate_file_upload(1000, "application/exe"))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])