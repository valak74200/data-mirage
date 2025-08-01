# Data Mirage - 3D Intelligent Dataset Visualization

## Overview

Data Mirage is a complete, production-ready web application that transforms tabular datasets (CSV/JSON) into immersive 3D visualizations using real machine learning algorithms. The application now features a full authentication system with Replit Auth, multi-page architecture, and a modern animated interface with cyberpunk aesthetics.

The application includes user authentication, personal dataset management, real-time ML processing, and an improved 3D visualization engine with clean, simple rendering optimized for mobile devices (iPhone). All explanations are provided in French for ML beginners.

**Recent Major Updates (January 2025):**
- ✅ Complete authentication system with Replit Auth integration
- ✅ Multi-page architecture with landing page, authenticated home, and datasets management
- ✅ Modern animated interface with glassmorphism and cyberpunk design
- ✅ Improved 3D visualization engine optimized for clarity and simplicity
- ✅ PostgreSQL database integration with user-specific data storage
- ✅ Mobile-optimized 3D rendering for iPhone compatibility

## User Preferences

Preferred communication style: Simple, everyday language.
Mobile device testing: iPhone - requires optimized mobile 3D visualization
UI Design: Modern, animated interface with cyberpunk aesthetics and glassmorphism
3D Visualization: Clean, clear, and simple - no visual clutter
Language: All ML explanations in French for beginners

## System Architecture

### Frontend Architecture
The frontend is built using React with TypeScript and utilizes a modern component-based architecture with zero external 3D dependencies:

- **React + TypeScript**: Provides type safety and component modularity
- **Native React State**: Custom hooks for state management (replaced Zustand for simplicity)
- **React Query**: Server state management and caching
- **React Router (Wouter)**: Lightweight routing solution
- **Custom Canvas 3D**: Native HTML5 Canvas-based 3D renderer with mathematical projections
- **Framer Motion**: Smooth animations and transitions
- **Tailwind CSS**: Utility-first styling with custom cyberpunk theme

The UI follows a glassmorphism design pattern with neon accents, featuring:
- A fixed side control panel for dataset upload and ML configuration
- Main 3D visualization area with interactive camera controls
- Floating info panels for displaying point details and legends
- Real-time processing feedback through WebSocket connections

### Backend Architecture
The backend uses Node.js with Express and follows a modular service architecture:

- **Express.js**: Web server and API routing
- **TypeScript**: Type safety across the entire stack
- **WebSocket**: Real-time communication for processing updates
- **Native File Processing**: Direct JSON payload handling for file uploads
- **Memory Storage**: In-memory data persistence with full CRUD operations
- **Real ML Service**: Complete mathematical implementations of all algorithms

The API exposes RESTful endpoints for:
- Dataset upload and management
- ML processing configuration
- Visualization data retrieval

### Data Processing Pipeline
The application implements a complete ML processing pipeline with real algorithms:

1. **Data Import**: Native CSV/JSON parsing with automatic type detection
2. **Data Preprocessing**: Matrix normalization and feature extraction
3. **Dimensionality Reduction**: 
   - **t-SNE**: Simplified implementation with PCA preprocessing
   - **UMAP**: Non-linear manifold learning with tanh transformations
4. **Clustering**: 
   - **K-Means**: Full iterative algorithm with centroid convergence
   - **DBSCAN**: Density-based clustering with epsilon neighborhoods
5. **Anomaly Detection**: Statistical outlier detection using cluster distance thresholds (mean + 2σ)
6. **3D Visualization**: Custom Canvas-based 3D renderer with rotation, zoom, and perspective projection

### Database Schema
The application uses Drizzle ORM with PostgreSQL schema definitions:

- **Datasets Table**: Stores original data, metadata, and processing results
- **Visualizations Table**: Stores ML configurations and processed visualization data
- Foreign key relationships linking visualizations to their source datasets

### Real-time Communication
WebSocket integration provides:
- Live processing status updates
- Real-time error reporting
- Interactive feedback during long-running ML operations

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React, React DOM, React Router (Wouter)
- **TypeScript**: Full-stack type safety
- **Vite**: Fast development server and build tool
- **Express.js**: Backend web framework

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework with custom cyberpunk theme
- **Radix UI**: Accessible component primitives
- **Framer Motion**: Animation library for smooth transitions
- **Shadcn/ui**: Pre-built component library with consistent theming

### 3D Visualization
- **Three.js**: 3D graphics library
- **React Three Fiber**: React renderer for Three.js
- **React Three Drei**: Useful helpers for React Three Fiber

### State Management and Data Fetching
- **Zustand**: Lightweight state management
- **React Query**: Server state management and caching
- **React Hook Form**: Form state management

### Machine Learning and Data Processing
- **Simplified ML algorithms**: Basic implementations for t-SNE, UMAP, K-Means, DBSCAN
- **Data utilities**: CSV parsing, normalization, statistical functions

### Database and Storage
- **Drizzle ORM**: Type-safe SQL query builder
- **PostgreSQL**: Primary database (configured via Neon serverless)
- **Memory storage**: Fallback for development

### Development Tools
- **ESBuild**: Fast JavaScript bundler for production
- **TSX**: TypeScript execution for development
- **Replit plugins**: Development environment integration

### File Upload and Processing
- **Multer**: Multipart form data handling
- **CSV/JSON parsers**: Data format support
- **File validation**: Type checking and size limits