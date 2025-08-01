# Data Mirage - Visualisation 3D Intelligente de Données

![Data Mirage](https://img.shields.io/badge/Data%20Mirage-3D%20Visualization-blueviolet)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)

## 🌟 Vue d'ensemble

Data Mirage est une plateforme web complète qui transforme vos datasets tabulaires (CSV/JSON) en visualisations 3D immersives et interactives, utilisant des algorithmes de machine learning réels pour révéler des insights cachés dans vos données.

### ✨ Caractéristiques principales

- **🎨 Visualisation 3D Native** - Moteur 3D personnalisé basé sur Canvas HTML5, sans dépendances externes
- **🤖 Machine Learning Intégré** - Algorithmes réels : t-SNE, UMAP, K-Means, DBSCAN avec détection automatique du nombre optimal de clusters
- **🔐 Authentification Complète** - Système de login/register avec Replit Auth et gestion des sessions
- **📱 Mobile-First** - Interface optimisée pour iPhone avec contrôles tactiles intuitifs
- **🎯 Détection d'Anomalies** - Identification automatique des points aberrants dans vos données
- **💬 Explications IA** - RAG (Retrieval-Augmented Generation) pour expliquer les clusters en français
- **🌙 Interface Cyberpunk** - Design glassmorphism moderne avec animations fluides

## 🚀 Technologies

### Frontend
- **React 18** avec TypeScript
- **Canvas API** pour le rendu 3D natif
- **Framer Motion** pour les animations
- **Tailwind CSS** avec thème cyberpunk personnalisé
- **React Query** pour la gestion du state serveur
- **Wouter** pour le routing léger

### Backend
- **FastAPI** (Python 3.11) pour l'API REST
- **scikit-learn** pour les algorithmes ML
- **pandas & numpy** pour le traitement des données
- **WebSocket** pour les mises à jour temps réel
- **PostgreSQL** avec Drizzle ORM
- **Perplexity API** pour les explications IA

## 🛠️ Installation

### Prérequis
- Node.js 20+
- Python 3.11+
- PostgreSQL

### Configuration

1. **Cloner le repository**
```bash
git clone https://github.com/votre-username/data-mirage.git
cd data-mirage
```

2. **Variables d'environnement**
Créez un fichier `.env` :
```env
DATABASE_URL=votre_url_postgresql
PERPLEXITY_API_KEY=votre_clé_api
SESSION_SECRET=votre_secret_session
```

3. **Installation des dépendances**
```bash
npm install
pip install -r requirements.txt
```

4. **Initialiser la base de données**
```bash
npm run db:push
```

5. **Lancer l'application**
```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5000`

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
├── client/              # Frontend React
│   ├── src/
│   │   ├── components/  # Composants UI réutilisables
│   │   ├── pages/       # Pages de l'application
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilitaires
├── server/              # Backend Node.js/Express
│   ├── routes.ts        # API endpoints
│   ├── services/        # Services ML et RAG
│   └── storage.ts       # Interface de stockage
├── python-backend/      # Services Python FastAPI
│   └── main.py          # Serveur ML
└── shared/              # Types partagés
    └── schema.ts        # Schémas de données
```

## 🎯 Algorithmes de Machine Learning

### Réduction de dimensionnalité
- **t-SNE** : Préserve les structures locales, idéal pour visualiser des clusters
- **UMAP** : Plus rapide, préserve mieux la structure globale

### Clustering
- **K-Means** : Détection automatique du nombre optimal via la méthode du coude
- **DBSCAN** : Clustering basé sur la densité, trouve des formes arbitraires

### Détection d'anomalies
- Basée sur la distance statistique aux centroïdes (moyenne + 2σ)

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

- Développé avec ❤️ sur [Replit](https://replit.com)
- Algorithmes ML inspirés par scikit-learn
- Design UI/UX moderne avec Tailwind CSS et Framer Motion

---

**Data Mirage** - Transformez vos données en expériences visuelles immersives 🚀