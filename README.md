# Data Mirage - Visualisation 3D Intelligente de Données

![Data Mirage](https://img.shields.io/badge/Data%20Mirage-3D%20Visualization-blueviolet)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat&logo=sqlalchemy&logoColor=white)

## 🌟 Vue d'ensemble

Data Mirage est une plateforme web complète qui transforme vos datasets tabulaires (CSV/JSON) en visualisations 3D immersives et interactives, utilisant des algorithmes de machine learning avancés pour révéler des insights cachés dans vos données.

### ✨ Caractéristiques principales

- **🎨 Visualisation 3D Unifiée** - Composant Canvas3D moderne avec rendu optimisé haute performance
- **🤖 Machine Learning Avancé** - Algorithmes réels : t-SNE, UMAP, K-Means, DBSCAN, HDBSCAN avec détection automatique
- **🔐 Authentification JWT** - Système complet avec sécurité renforcée et gestion des sessions
- **📱 Responsive Design** - Interface adaptive optimisée pour tous les appareils
- **🎯 Détection d'Anomalies** - Algorithmes sophistiqués pour identifier les points aberrants
- **💬 Explications IA** - RAG (Retrieval-Augmented Generation) avec OpenAI pour expliquer les insights
- **🌙 Interface Moderne** - Design glassmorphism avec animations fluides et thème sombre

## 🚀 Technologies

### Frontend
- **React 18** avec TypeScript
- **Canvas API** pour le rendu 3D natif
- **Framer Motion** pour les animations
- **Tailwind CSS** avec thème cyberpunk personnalisé
- **React Query** pour la gestion du state serveur
- **Wouter** pour le routing léger

### Backend
- **FastAPI** (Python 3.9+) pour l'API REST haute performance
- **SQLAlchemy** avec Alembic pour l'ORM et les migrations
- **scikit-learn** pour les algorithmes ML avancés
- **pandas & numpy** pour le traitement efficace des données
- **WebSocket** pour les mises à jour temps réel
- **JWT** avec sécurité renforcée pour l'authentification
- **OpenAI API** pour les explications IA

## 🛠️ Installation

### Prérequis
- Node.js 18+
- Python 3.9+
- SQLite (inclus) ou PostgreSQL (optionnel)

### Configuration

1. **Cloner le repository**
```bash
git clone https://github.com/votre-username/data-mirage.git
cd data-mirage
```

2. **Variables d'environnement**
Créez un fichier `.env` :
```env
# Database (SQLite par défaut)
DATABASE_URL=sqlite:///./data_mirage.db

# Security
SECRET_KEY=votre-clé-secrète-sécurisée

# Environment
ENVIRONMENT=development
DEBUG=true

# Optional: OpenAI API Key
OPENAI_API_KEY=votre_clé_openai
```

3. **Installation des dépendances**
```bash
# Frontend
npm install

# Backend Python
pip install fastapi uvicorn[standard] pydantic pydantic-settings sqlalchemy asyncpg alembic python-jose[cryptography] passlib[bcrypt] python-multipart scikit-learn pandas numpy umap-learn hdbscan openai redis python-dotenv
```

4. **Initialiser la base de données**
```bash
npm run db:migrate
```

5. **Lancer l'application**
```bash
# Mode développement (avec hot-reload)
npm run dev

# Ou lancer séparément :
# Backend: cd app && python run.py --reload
# Frontend: npm run build && npm run preview
```

L'application sera accessible sur :
- **Backend API** : `http://localhost:8000`
- **Frontend** : `http://localhost:5173` (dev) ou via le backend
- **Documentation API** : `http://localhost:8000/docs`

## 📊 Utilisation

1. **Connexion** - Créez un compte ou connectez-vous
2. **Upload** - Chargez votre dataset CSV ou JSON
3. **Configuration** - Choisissez vos algorithmes :
   - Réduction : t-SNE ou UMAP
   - Clustering : K-Means ou DBSCAN
   - Détection d'anomalies : Activée/Désactivée
4. **Visualisation** - Explorez vos données en 3D :
   - 🖱️ Rotation : Clic + glisser
   - 🔍 Zoom : Molette ou pincer
   - 👆 Sélection : Clic sur un point
   - 🔄 Auto-rotation : Activable

## 🏗️ Architecture

```
data-mirage/
├── app/                 # Backend FastAPI unifié
│   ├── api/            # Endpoints API (auth, datasets, ml)
│   ├── core/           # Configuration et sécurité
│   ├── models/         # Modèles SQLAlchemy
│   ├── schemas/        # Schémas Pydantic
│   ├── services/       # Services ML et business logic
│   ├── migrations/     # Migrations Alembic
│   ├── main.py         # Application FastAPI principale
│   └── run.py          # Script de lancement
├── client/             # Frontend React optimisé
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas3D/    # Composant 3D unifié
│   │   │   ├── ui/          # Composants UI shadcn/ui
│   │   │   └── visualization/ # Composants de visualisation
│   │   ├── pages/       # Pages de l'application
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilitaires et API client
│   │   └── stores/      # Gestion d'état
├── shared/             # Types TypeScript partagés
│   └── types.ts        # Interfaces et types communs
└── attached_assets/    # Assets et exemples de données
```

## 🎯 Algorithmes de Machine Learning

### Réduction de dimensionnalité
- **t-SNE** : Préserve les structures locales, idéal pour visualiser des clusters
- **UMAP** : Plus rapide, préserve mieux la structure globale

### Clustering
- **K-Means** : Détection automatique du nombre optimal via la méthode du coude et silhouette
- **DBSCAN** : Clustering basé sur la densité, trouve des formes arbitraires
- **HDBSCAN** : Version hiérarchique de DBSCAN pour des clusters de densités variables

### Détection d'anomalies
- **Isolation Forest** : Algorithme de détection d'anomalies par isolation
- **Distance statistique** : Basée sur la distance aux centroïdes (moyenne + 2σ)
- **Local Outlier Factor** : Détection basée sur la densité locale

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🙏 Remerciements

- Développé avec ❤️ pour la communauté open source
- Algorithmes ML basés sur scikit-learn et UMAP
- Design UI/UX moderne avec Tailwind CSS, shadcn/ui et Framer Motion
- Architecture FastAPI inspirée des meilleures pratiques Python modernes

---

**Data Mirage** - Transformez vos données en expériences visuelles immersives 🚀