import os
import requests
import json
from typing import List, Dict, Any
from pydantic import BaseModel

# Define schemas locally to avoid import issues
class ClusterAnalysis(BaseModel):
    clusterId: int
    explanation: str
    characteristics: List[str]
    dataPoints: int
    keyFeatures: List[str]

class Point3D(BaseModel):
    id: str
    position: List[float]
    color: str
    cluster: int
    originalData: Dict[str, Any]

class Cluster(BaseModel):
    id: int
    color: str
    center: List[float]
    points: List[str]

class ProcessingResult(BaseModel):
    points: List[Point3D]
    clusters: List[Cluster]
    anomalies: List[str]

class RAGService:
    def __init__(self):
        self.api_key = os.getenv('PERPLEXITY_API_KEY')
        if not self.api_key:
            raise ValueError('PERPLEXITY_API_KEY environment variable is required')
        
        self.api_url = 'https://api.perplexity.ai/chat/completions'
    
    async def explain_clusters(self, result: ProcessingResult, metadata: Dict[str, Any]) -> List[ClusterAnalysis]:
        """Generate AI explanations for discovered clusters"""
        analyses = []
        
        for cluster in result.clusters:
            try:
                # Get points in this cluster
                cluster_points = [p for p in result.points if p.cluster == cluster.id]
                
                # Extract statistical features
                features = self._extract_cluster_features(cluster_points, metadata)
                
                # Generate explanation
                explanation = await self._generate_cluster_explanation(cluster, features, metadata)
                
                analyses.append(ClusterAnalysis(
                    clusterId=cluster.id,
                    explanation=explanation['explanation'],
                    characteristics=explanation['characteristics'],
                    dataPoints=len(cluster_points),
                    keyFeatures=explanation['keyFeatures']
                ))
                
            except Exception as e:
                print(f"Error analyzing cluster {cluster.id}: {e}")
                # Fallback explanation
                analyses.append(ClusterAnalysis(
                    clusterId=cluster.id,
                    explanation=f"Cluster {cluster.id} contient {len(cluster.points)} points de données avec des caractéristiques similaires.",
                    characteristics=["Données groupées par similarité", "Analyse en cours"],
                    dataPoints=len(cluster.points),
                    keyFeatures=["Caractéristiques communes", "Patron identifié"]
                ))
        
        return analyses
    
    def _extract_cluster_features(self, cluster_points: List, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Extract statistical features from cluster points"""
        features = {}
        
        if not metadata.get('columns') or not cluster_points:
            return features
        
        # Analyze each numeric column
        for column in metadata['columns']:
            values = []
            for point in cluster_points:
                if point.originalData and column in point.originalData:
                    try:
                        value = float(point.originalData[column])
                        values.append(value)
                    except (ValueError, TypeError):
                        continue
            
            if values:
                import numpy as np
                features[column] = {
                    'moyenne': round(np.mean(values), 2),
                    'médiane': round(np.median(values), 2),
                    'minimum': round(np.min(values), 2),
                    'maximum': round(np.max(values), 2),
                    'étendue': round(np.max(values) - np.min(values), 2)
                }
        
        return features
    
    async def _generate_cluster_explanation(self, cluster, features: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Generate explanation using Perplexity API"""
        
        # Build feature description
        feature_descriptions = []
        for column, stats in features.items():
            feature_descriptions.append(
                f"{column}: moyenne {stats['moyenne']}, médiane {stats['médiane']}, étendue {stats['étendue']}"
            )
        
        feature_text = ", ".join(feature_descriptions) if feature_descriptions else "données numériques"
        
        prompt = f"""Tu es un expert en analyse de données. Analyse ce cluster de données et explique-le en français simple pour des débutants.

Dataset: {metadata.get('fileName', 'données')}
Cluster {cluster.id}: {len(cluster.points)} points de données
Caractéristiques statistiques: {feature_text}

Explique en 2-3 phrases courtes:
1. Ce que représente ce groupe de données
2. Ses caractéristiques principales  
3. Pourquoi ces points sont regroupés ensemble

Réponds uniquement en français, de manière simple et compréhensible."""

        try:
            response = await self._call_perplexity_api(prompt)
            return self._parse_response(response)
        except Exception as e:
            print(f"Perplexity API error: {e}")
            return {
                'explanation': f"Cluster {cluster.id} regroupe des données ayant des valeurs similaires pour les variables analysées.",
                'characteristics': ["Valeurs similaires", "Groupe homogène"],
                'keyFeatures': ["Patron identifié", "Caractéristiques communes"]
            }
    
    async def _call_perplexity_api(self, prompt: str) -> Dict[str, Any]:
        """Call Perplexity API"""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'llama-3.1-sonar-small-128k-online',
            'messages': [
                {
                    'role': 'system',
                    'content': 'Tu es un expert en analyse de données qui explique les résultats en français simple pour des débutants en machine learning.'
                },
                {
                    'role': 'user', 
                    'content': prompt
                }
            ],
            'max_tokens': 300,
            'temperature': 0.3,
            'top_p': 0.9,
            'stream': False
        }
        
        response = requests.post(self.api_url, headers=headers, json=payload)
        response.raise_for_status()
        
        return response.json()
    
    def _parse_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Perplexity response"""
        content = response.get('choices', [{}])[0].get('message', {}).get('content', '')
        
        explanation = content.strip()
        
        # Extract characteristics
        characteristics = self._extract_characteristics(content)
        
        # Extract key features
        key_features = self._extract_key_features(content)
        
        return {
            'explanation': explanation,
            'characteristics': characteristics,
            'keyFeatures': key_features
        }
    
    def _extract_characteristics(self, content: str) -> List[str]:
        """Extract characteristics from response"""
        characteristics = []
        
        # Keywords to look for
        patterns = [
            'valeurs élevées', 'valeurs faibles', 'valeurs moyennes',
            'tendance croissante', 'tendance décroissante', 'tendance stable',
            'corrélation positive', 'corrélation négative', 'corrélation forte',
            'concentrés', 'dispersés', 'homogènes', 'hétérogènes',
            'groupe distinct', 'caractéristiques communes'
        ]
        
        content_lower = content.lower()
        for pattern in patterns:
            if pattern in content_lower:
                characteristics.append(pattern.title())
        
        # Default characteristics if none found
        if not characteristics:
            characteristics = ["Données groupées par similarité", "Caractéristiques communes identifiées"]
        
        return characteristics[:4]  # Limit to 4
    
    def _extract_key_features(self, content: str) -> List[str]:
        """Extract key features from response"""
        features = []
        
        keywords = ['moyenne', 'médiane', 'maximum', 'minimum', 'étendue', 'variance', 'tendance', 'patron']
        content_lower = content.lower()
        
        for keyword in keywords:
            if keyword in content_lower:
                features.append(keyword.capitalize())
        
        # Default features if none found
        if not features:
            features = ["Patron identifié", "Structure commune"]
        
        return features[:3]  # Limit to 3