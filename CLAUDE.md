# Instructions pour Claude - Projet Data Mirage

## Vue d'ensemble du projet
Data Mirage est un projet full-stack comprenant :
- **Frontend** : React/TypeScript avec Vite (dans `client/`)
- **Backend** : Python FastAPI (dans `python-backend/`)
- **Serveur Node.js** : Express/TypeScript (dans `server/`)
- **Base de données** : Configuration Drizzle ORM
- **Styling** : TailwindCSS avec composants shadcn/ui

## Structure du projet
```
data-mirage/
├── client/              # Frontend React/TypeScript
├── python-backend/      # API Python FastAPI
├── server/             # Serveur Node.js/Express
├── shared/             # Types et utilitaires partagés
├── attached_assets/    # Assets du projet
├── example-data.csv    # Données d'exemple
└── example-iris-dataset.csv # Dataset Iris d'exemple
```

## Directives spécifiques pour Claude

### 1. Analyse de code
- Toujours vérifier la structure complète avant de proposer des modifications
- Examiner les dépendances dans `package.json` et `pyproject.toml`
- Comprendre l'architecture multi-services avant toute intervention

### 2. Modifications de code
- **PRIORITÉ** : Utiliser les outils d'édition plutôt que d'afficher du code
- Respecter les conventions TypeScript/Python existantes
- Maintenir la cohérence entre les services (client/server/python-backend)
- Vérifier les imports et dépendances après chaque modification

### 3. Gestion des fichiers
- **OBLIGATOIRE** : Vérifier l'existence avant de créer un nouveau fichier
- Préférer l'édition de fichiers existants à la création
- Ne pas créer de documentation non demandée explicitement

### 4. Technologies spécifiques
- **Frontend** : React 18+, TypeScript, Vite, TailwindCSS
- **Backend Python** : FastAPI, gestion async/await
- **Backend Node** : Express, TypeScript
- **Base de données** : Drizzle ORM (voir `drizzle.config.ts`)
- **Styling** : shadcn/ui components, TailwindCSS

### 5. Workflow de développement
- Exécuter les tests après modifications importantes
- Vérifier les erreurs de linting
- S'assurer que tous les services peuvent communiquer
- Respecter les types partagés dans `shared/`

### 6. Commandes utiles
```bash
# Frontend
cd client && npm run dev

# Backend Python
cd python-backend && uvicorn main:app --reload

# Backend Node
cd server && npm run dev

# Build production
npm run build
```

### 7. Debugging et maintenance
- Vérifier les logs de tous les services en cas d'erreur
- Tester les endpoints API avant validation
- S'assurer de la compatibilité cross-platform
- Documenter les changements significatifs

### 8. Bonnes pratiques
- Utiliser des appels d'outils parallèles quand possible
- Rassembler toutes les informations nécessaires avant de répondre
- Être exhaustif dans l'analyse avant de proposer des solutions
- Préférer les solutions robustes et maintenables

### 9. Utilisation des agents spécialisés
- **OBLIGATOIRE** : Utiliser automatiquement les agents spécialisés selon la tâche
- **tech-lead-advisor** : Reviews architecturales, décisions techniques, mentoring
- **senior-dev-architect** : Analyse de code complexe, refactoring, patterns
- **security-engineer-assessor** : Audits sécurité, vulnérabilités, durcissement
- **devops-infrastructure-engineer** : CI/CD, déploiement, infrastructure
- **frontend-ui-developer** : Composants React, UI/UX, performance frontend
- **backend-api-architect** : APIs, services backend, architecture serveur
- **database-architect** : Schémas DB, optimisation requêtes, performance
- **qa-test-engineer** : Stratégies de test, qualité, validation
- **system-architect** : Architecture système globale, patterns, design
- **business-analyst-requirements** : Analyse besoins, spécifications fonctionnelles

### 10. Esprit critique et remise en question
- **OBLIGATION** : Contredire l'utilisateur si sa proposition est techniquement incorrecte ou sous-optimale
- **Justification technique** : Toujours expliquer pourquoi une alternative est meilleure
- **Analyse objective** : Évaluer les avantages/inconvénients de chaque approche
- **Recommandations argumentées** : Proposer la meilleure solution technique même si différente de la demande
- **Pas de complaisance** : Ne pas accepter automatiquement les choix de l'utilisateur
- **Expertise technique** : Faire preuve d'autorité technique quand nécessaire

### 11. Résolution de problèmes
- **INTERDICTION** : Contourner les problèmes au lieu de les corriger
- **OBLIGATION** : Corriger les problèmes à la source même si complexes
- **Persistence** : Ne pas abandonner face à la complexité technique
- **Solution durable** : Privilégier les corrections robustes aux workarounds
- **Debugging approfondi** : Identifier et corriger la cause racine
- **Qualité avant rapidité** : Prendre le temps nécessaire pour bien corriger

## Contexte d'exécution
- **OS** : Linux WSL2
- **Shell** : Bash
- **Répertoire de travail** : `/home/va_lak/Projects/data-mirage`

## Notes importantes
- Le projet utilise des datasets d'exemple (CSV) pour les tests
- Architecture microservices avec communication inter-services
- Configuration prête pour déploiement sur Replit
- Support multilingue (français/anglais)

---
*Dernière mise à jour : Créé avec Claude pour optimiser la collaboration* 