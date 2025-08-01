# Data Mirage FastAPI Architecture

## 🎯 Vue d'ensemble

Architecture FastAPI complète et moderne qui remplace l'infrastructure hybride Node.js + Python. Cette nouvelle architecture intègre nativement tous les services ML dans un seul backend Python performant et sécurisé.

## 🏗️ Architecture

### Structure du projet

```
app/
├── main.py                 # Application FastAPI principale
├── run.py                  # Script de démarrage
├── migrate.py              # Utilitaires de migration DB
├── alembic.ini            # Configuration Alembic
│
├── core/                   # Configuration et utilitaires centraux
│   ├── config.py          # Configuration et variables d'environnement
│   ├── security.py        # Authentification JWT et hachage
│   ├── database.py        # Configuration SQLAlchemy async
│   └── deps.py           # Injection de dépendances FastAPI
│
├── api/                    # Routes API organisées par domaine
│   ├── auth.py           # Authentification (register, login, etc.)
│   ├── users.py          # Gestion utilisateurs
│   ├── datasets.py       # CRUD datasets et upload fichiers
│   └── ml.py            # Traitement ML et 3D
│
├── models/                 # Modèles SQLAlchemy
│   ├── user.py           # Modèle User avec relations
│   ├── dataset.py        # Modèle Dataset avec métadonnées
│   └── session.py        # Modèles Session et Visualization
│
├── schemas/                # Schémas Pydantic pour validation
│   ├── user.py           # Schémas utilisateur et auth
│   ├── dataset.py        # Schémas dataset et métadonnées
│   └── ml.py            # Schémas ML et processing
│
├── services/               # Services métier
│   ├── auth.py           # Service authentification
│   ├── ml_processor.py   # Processeur ML intégré
│   ├── rag_service.py    # Service RAG pour explications IA
│   └── websocket.py      # Manager WebSocket temps réel
│
├── migrations/             # Migrations Alembic
│   ├── env.py            # Configuration environnement Alembic
│   └── script.py.mako    # Template migrations
│
└── tests/                  # Suite de tests
    ├── conftest.py       # Configuration tests et fixtures
    └── test_*.py         # Tests unitaires et intégration
```

## 🚀 Fonctionnalités

### 🔐 Authentification JWT sécurisée
- Registration/login avec validation mot de passe
- Tokens JWT avec refresh tokens
- Gestion sessions multi-appareils
- Rate limiting et protection brute force
- Hash bcrypt sécurisé

### 📊 Gestion datasets complète
- Upload fichiers CSV, JSON, Excel
- Métadonnées automatiques et statistiques colonnes  
- Versioning datasets
- Contrôle accès public/privé
- Validation et parsing robuste

### 🤖 ML Processing intégré
- **Réduction dimensionnelle** : t-SNE, UMAP, PCA
- **Clustering** : K-Means, DBSCAN, HDBSCAN, Agglomerative
- **Détection anomalies** : Isolation Forest
- **Métriques performance** : Silhouette, Calinski-Harabasz
- Configuration flexible par algorithme
- Processing asynchrone avec progress tracking

### 🧠 IA et RAG
- Explications clusters générées par OpenAI
- Support multilingue (FR/EN)
- Analyse caractéristiques datasets
- Insights automatiques sur patterns

### ⚡ WebSocket temps réel
- Updates processing en direct
- Notifications utilisateur
- Gestion connexions multiples
- Room système pour datasets
- Heartbeat et reconnexion

### 🛡️ Sécurité production
- CORS configuré
- Rate limiting Redis
- Validation input stricte
- Logging sécurisé
- Error handling robuste
- Trusted host middleware

## 📦 Installation

### Prérequis
- Python 3.11+
- PostgreSQL 13+
- Redis 6+
- (Optionnel) OpenAI API key pour RAG

### Installation

1. **Cloner et configurer** :
```bash
cd app/
cp ../.env.example .env
# Éditer .env avec vos paramètres
```

2. **Installer dépendances** :
```bash
pip install -e .
# Ou pour développement :
pip install -e ".[dev]"
```

3. **Configurer base de données** :
```bash
# Créer base PostgreSQL
createdb datamirage

# Configurer DATABASE_URL in .env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/datamirage

# Initialiser migrations
python migrate.py init
python migrate.py create "Initial migration"
python migrate.py migrate
```

4. **Démarrer Redis** :
```bash
redis-server
```

5. **Lancer l'application** :
```bash
python run.py --reload  # Mode développement
# Ou
python run.py --workers 4  # Mode production
```

## 🔧 Configuration

### Variables d'environnement

Créer `.env` basé sur `.env.example` :

```bash
# Application
APP_NAME="Data Mirage API"
DEBUG=false
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/datamirage

# Security
SECRET_KEY=your-super-secret-key-32-chars-minimum
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI (optionnel)
OPENAI_API_KEY=sk-your-openai-key

# CORS
CORS_ORIGINS=http://localhost:3000,https://yourapp.com
```

### Configuration avancée

Modifier `app/core/config.py` pour :
- Paramètres ML par défaut
- Limites upload fichiers
- Configuration rate limiting
- Settings WebSocket
- Paramètres RAG

## 🔌 API Endpoints

### Authentification
```
POST   /api/auth/register      # Inscription
POST   /api/auth/login         # Connexion  
POST   /api/auth/refresh       # Refresh token
POST   /api/auth/logout        # Déconnexion
GET    /api/auth/me           # Profil utilisateur
PUT    /api/auth/me           # Modifier profil
POST   /api/auth/change-password  # Changer mot de passe
GET    /api/auth/sessions     # Sessions actives
```

### Datasets
```
POST   /api/datasets/upload    # Upload fichier
GET    /api/datasets          # Lister datasets
GET    /api/datasets/{id}     # Détails dataset
GET    /api/datasets/{id}/data # Données complètes
PUT    /api/datasets/{id}     # Modifier dataset
DELETE /api/datasets/{id}     # Supprimer dataset
GET    /api/datasets/{id}/stats # Statistiques
```

### Machine Learning
```
POST   /api/ml/process/{dataset_id}  # Traiter dataset
GET    /api/ml/progress/{dataset_id} # Progression
GET    /api/ml/results/{dataset_id}  # Résultats 3D
POST   /api/ml/explain/{dataset_id}  # Explications IA
GET    /api/ml/algorithms            # Algorithmes disponibles
```

### Utilisateurs (Admin)
```
GET    /api/users             # Lister utilisateurs
GET    /api/users/{id}        # Détails utilisateur
PUT    /api/users/{id}/activate   # Activer compte
PUT    /api/users/{id}/deactivate # Désactiver compte
DELETE /api/users/{id}        # Supprimer utilisateur
```

### WebSocket
```
WS     /ws                    # Connexion WebSocket temps réel
```

## 📡 WebSocket Events

### Événements émis par le serveur
```javascript
// Début processing
{
  "type": "processing_started",
  "dataset_id": "uuid",
  "config": {...},
  "user_id": "uuid"
}

// Progression
{
  "type": "processing_progress", 
  "dataset_id": "uuid",
  "stage": "clustering",
  "progress": 75.5,
  "message": "Performing clustering..."
}

// Completion processing
{
  "type": "processing_completed",
  "dataset_id": "uuid", 
  "result": {...}
}

// Explications IA terminées
{
  "type": "rag_completed",
  "dataset_id": "uuid",
  "explanations": [...]
}

// Erreur
{
  "type": "processing_error",
  "dataset_id": "uuid",
  "error": "Error message"
}
```

### Messages clients
```javascript
// Ping/pong heartbeat
{"type": "ping"}

// Rejoindre room dataset  
{"type": "join_dataset", "dataset_id": "uuid"}

// Quitter room dataset
{"type": "leave_dataset", "dataset_id": "uuid"}
```

## 🧪 Tests

### Lancer les tests
```bash
# Tests complets
pytest

# Tests avec couverture
pytest --cov=app --cov-report=html

# Tests spécifiques
pytest app/tests/test_auth.py -v

# Tests en mode watch
pytest --watch
```

### Structure tests
- `conftest.py` : Fixtures et configuration
- `test_main.py` : Tests endpoints principaux
- `test_auth.py` : Tests authentification
- `test_datasets.py` : Tests datasets
- `test_ml.py` : Tests ML processing
- `test_services/` : Tests services métier

## 🗄️ Base de données

### Migrations

```bash
# Créer migration
python migrate.py create "Add new field"

# Appliquer migrations
python migrate.py migrate

# Rollback
python migrate.py rollback

# Historique
python migrate.py history

# État actuel
python migrate.py current
```

### Modèles principaux

**User** : Utilisateurs avec authentification
- JWT tokens et sessions
- Profils et permissions
- Relations vers datasets

**Dataset** : Datasets avec métadonnées
- Données originales et traitées
- Versioning et accès
- Statistiques colonnes

**Session** : Sessions utilisateur
- Refresh tokens
- Info appareils
- Expiration et révocation

**Visualization** : Résultats visualisation 3D
- Configuration ML
- Coordonnées 3D
- Métriques performance

## 🚀 Déploiement

### Mode production

1. **Variables d'environnement** :
```bash
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=strong-production-key
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
```

2. **Base de données** :
```bash
python migrate.py migrate
```

3. **Lancement** :
```bash
python run.py --workers 4 --host 0.0.0.0 --port 8000
# Ou avec Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Docker (optionnel)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .
RUN pip install -e .

EXPOSE 8000
CMD ["python", "run.py", "--host", "0.0.0.0"]
```

### Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🔄 Migration depuis Node.js

### Étapes migration

1. **Backup données** existantes
2. **Déployer** nouvelle API FastAPI
3. **Migrer** données vers PostgreSQL
4. **Tester** endpoints avec frontend
5. **Basculer** traffic progressivement
6. **Supprimer** ancienne infrastructure

### Compatibilité API

L'API FastAPI maintient la compatibilité avec les endpoints existants :
- Mêmes routes `/api/*`
- Mêmes formats JSON
- Même WebSocket `/ws`
- Authentification compatible

### Points d'attention

- **Base de données** : Migration Drizzle → SQLAlchemy
- **Sessions** : Nouvelle gestion JWT
- **Processing** : ML intégré vs. séparé
- **WebSocket** : Nouveau manager mais protocole compatible

## 📊 Performance

### Optimisations intégrées

- **Async/await** partout
- **Connection pooling** DB
- **Redis caching** sessions
- **Streaming** upload fichiers
- **Background tasks** ML
- **Rate limiting** Redis
- **Query optimization** SQLAlchemy

### Monitoring

```python
# Métriques disponibles via /health/detailed
{
  "database": {"status": "healthy"},
  "websocket": {"connections": 42},
  "ml_services": {"features": [...]}
}
```

## 🛠️ Développement

### Setup développement

```bash
# Installation dev
pip install -e ".[dev]"

# Pre-commit hooks
pre-commit install

# Format code
black app/
isort app/

# Type checking
mypy app/

# Linting
flake8 app/
```

### Architecture guidelines

- **Separation of concerns** : API / Services / Models
- **Dependency injection** : FastAPI deps
- **Type safety** : Pydantic + MyPy
- **Async first** : async/await partout
- **Error handling** : Exceptions typées
- **Logging** : Structured logging
- **Testing** : pytest + fixtures

## 🔒 Sécurité

### Mesures implémentées

- **JWT** avec refresh tokens
- **Password hashing** bcrypt
- **Rate limiting** par IP
- **CORS** configuré
- **Input validation** Pydantic
- **SQL injection** protection SQLAlchemy
- **Secrets** via variables environnement
- **Session management** sécurisé

### Checklist production

- [ ] SECRET_KEY fort et unique
- [ ] DATABASE_URL avec credentials sécurisés  
- [ ] CORS origins restrictifs
- [ ] Rate limiting activé
- [ ] HTTPS obligatoire
- [ ] Logs centralisés
- [ ] Monitoring erreurs
- [ ] Backups automatisés

## 📚 Documentation

- **API Docs** : `/docs` (Swagger UI)
- **ReDoc** : `/redoc` (ReDoc UI)
- **Health** : `/health` et `/health/detailed`
- **OpenAPI** : `/openapi.json`

## 🎯 Avantages vs Architecture précédente

### ✅ Améliorations

1. **Performance** : Async natif, moins de latence
2. **Simplicité** : Un seul service vs. 2 séparés  
3. **Maintenance** : Code Python unifié
4. **Sécurité** : JWT natif, rate limiting intégré
5. **Scalabilité** : Workers multiples, connection pooling
6. **DX** : Auto-documentation, validation types
7. **Testing** : Suite tests complète intégrée
8. **Monitoring** : Health checks détaillés

### 🔄 Compatibilité maintenue

- Mêmes endpoints API
- Même protocole WebSocket  
- Mêmes formats données
- Frontend React inchangé

Cette architecture FastAPI moderne fournit une base solide, sécurisée et performante pour Data Mirage, tout en éliminant la complexité de l'infrastructure hybride précédente.