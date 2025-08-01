"""
RAG (Retrieval-Augmented Generation) service for generating AI explanations of clustering results.
Uses OpenAI API to provide intelligent insights about data clusters and patterns.
"""

import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
import openai
from openai import AsyncOpenAI
import numpy as np
from collections import Counter

from schemas.ml import ProcessingResult, ClusterAnalysis
from schemas.dataset import DatasetMetadata
from core.config import settings

logger = logging.getLogger(__name__)


class RAGServiceError(Exception):
    """RAG service related errors."""
    pass


class OpenAIError(RAGServiceError):
    """OpenAI API related errors."""
    pass


class RAGService:
    """
    RAG service for generating AI-powered explanations of data analysis results.
    
    Features:
    - Cluster analysis and interpretation
    - Pattern recognition insights
    - Feature importance explanation
    - Data-driven storytelling
    - Multi-language support
    """
    
    def __init__(self):
        """Initialize RAG service with OpenAI client."""
        self.client = None
        self.model = settings.rag_settings.model
        self.max_tokens = settings.rag_settings.max_tokens
        self.temperature = settings.rag_settings.temperature
        self.max_retries = settings.rag_settings.max_retries
        
        # Initialize OpenAI client if API key is available
        if settings.rag_settings.openai_api_key:
            self.client = AsyncOpenAI(api_key=settings.rag_settings.openai_api_key)
        else:
            logger.warning("OpenAI API key not configured. RAG service will provide fallback explanations.")
    
    async def explain_clusters(
        self,
        processing_result: ProcessingResult,
        dataset_metadata: Optional[DatasetMetadata] = None,
        language: str = "fr",
    ) -> List[ClusterAnalysis]:
        """
        Generate AI explanations for clusters in processing results.
        
        Args:
            processing_result: ML processing results
            dataset_metadata: Dataset metadata for context
            language: Language for explanations (fr/en)
            
        Returns:
            List of cluster analyses with AI explanations
        """
        try:
            explanations = []
            
            for cluster in processing_result.clusters:
                explanation = await self._explain_single_cluster(
                    cluster,
                    processing_result,
                    dataset_metadata,
                    language,
                )
                explanations.append(explanation)
            
            return explanations
            
        except Exception as e:
            logger.error(f"Failed to generate cluster explanations: {e}")
            # Return fallback explanations
            return self._generate_fallback_explanations(processing_result, language)
    
    async def _explain_single_cluster(
        self,
        cluster,
        processing_result: ProcessingResult,
        dataset_metadata: Optional[DatasetMetadata],
        language: str,
    ) -> ClusterAnalysis:
        """
        Generate explanation for a single cluster.
        
        Args:
            cluster: Cluster information
            processing_result: Full processing results
            dataset_metadata: Dataset metadata
            language: Language for explanation
            
        Returns:
            ClusterAnalysis with AI-generated explanation
        """
        # Get points in this cluster
        cluster_points = [
            point for point in processing_result.points
            if point.cluster == cluster.id
        ]
        
        if not cluster_points:
            return self._create_fallback_explanation(cluster, language)
        
        # Analyze cluster characteristics
        characteristics = self._analyze_cluster_characteristics(cluster_points)
        
        # Generate AI explanation if available
        if self.client:
            try:
                explanation = await self._generate_ai_explanation(
                    cluster,
                    cluster_points,
                    characteristics,
                    processing_result.metadata,
                    dataset_metadata,
                    language,
                )
            except Exception as e:
                logger.warning(f"AI explanation failed for cluster {cluster.id}: {e}")
                explanation = self._create_fallback_explanation(cluster, language).explanation
        else:
            explanation = self._create_fallback_explanation(cluster, language).explanation
        
        return ClusterAnalysis(
            cluster_id=cluster.id,
            explanation=explanation,
            characteristics=characteristics,
            data_points=len(cluster_points),
            key_features=self._identify_key_features(cluster_points),
            representative_points=[point.id for point in cluster_points[:3]],
        )
    
    async def _generate_ai_explanation(
        self,
        cluster,
        cluster_points: List,
        characteristics: List[str],
        processing_metadata,
        dataset_metadata: Optional[DatasetMetadata],
        language: str,
    ) -> str:
        """
        Generate AI explanation using OpenAI API.
        
        Args:
            cluster: Cluster information
            cluster_points: Points in the cluster
            characteristics: Cluster characteristics
            processing_metadata: Processing metadata
            dataset_metadata: Dataset metadata
            language: Language for explanation
            
        Returns:
            AI-generated explanation string
        """
        # Prepare context information
        context = self._prepare_cluster_context(
            cluster,
            cluster_points,
            characteristics,
            processing_metadata,
            dataset_metadata,
        )
        
        # Create prompt based on language
        if language == "fr":
            system_prompt = self._get_french_system_prompt()
            user_prompt = self._create_french_user_prompt(context)
        else:
            system_prompt = self._get_english_system_prompt()
            user_prompt = self._create_english_user_prompt(context)
        
        # Generate explanation with retries
        for attempt in range(self.max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                )
                
                explanation = response.choices[0].message.content.strip()
                
                if explanation:
                    return explanation
                    
            except Exception as e:
                logger.warning(f"OpenAI API attempt {attempt + 1} failed: {e}")
                if attempt == self.max_retries - 1:
                    raise OpenAIError(f"Failed to generate explanation after {self.max_retries} attempts")
                
                # Wait before retry
                await asyncio.sleep(2 ** attempt)
        
        raise OpenAIError("Failed to generate explanation")
    
    def _prepare_cluster_context(
        self,
        cluster,
        cluster_points: List,
        characteristics: List[str],
        processing_metadata,
        dataset_metadata: Optional[DatasetMetadata],
    ) -> Dict[str, Any]:
        """Prepare context information for AI prompt."""
        # Sample some points for analysis
        sample_points = cluster_points[:5]
        sample_data = [point.original_data for point in sample_points]
        
        context = {
            "cluster_id": cluster.id,
            "cluster_size": len(cluster_points),
            "total_points": processing_metadata.total_points,
            "cluster_percentage": round((len(cluster_points) / processing_metadata.total_points) * 100, 1),
            "reduction_method": processing_metadata.reduction_method,
            "clustering_method": processing_metadata.clustering_method,
            "characteristics": characteristics,
            "sample_data": sample_data,
            "features_used": processing_metadata.features_used,
        }
        
        if dataset_metadata:
            context.update({
                "total_rows": dataset_metadata.row_count,
                "columns": dataset_metadata.columns,
                "column_types": dataset_metadata.column_types,
            })
        
        return context
    
    def _analyze_cluster_characteristics(self, cluster_points: List) -> List[str]:
        """Analyze characteristics of cluster points."""
        characteristics = []
        
        if not cluster_points:
            return characteristics
        
        # Analyze numerical features
        numerical_features = {}
        categorical_features = {}
        
        for point in cluster_points:
            for key, value in point.original_data.items():
                if isinstance(value, (int, float)) and not np.isnan(value):
                    if key not in numerical_features:
                        numerical_features[key] = []
                    numerical_features[key].append(value)
                elif value is not None:
                    if key not in categorical_features:
                        categorical_features[key] = []
                    categorical_features[key].append(str(value))
        
        # Analyze numerical patterns
        for feature, values in numerical_features.items():
            if len(values) > 1:
                mean_val = np.mean(values)
                std_val = np.std(values)
                
                if std_val < mean_val * 0.1:  # Low variance
                    characteristics.append(f"Valeurs {feature} homogènes (moyenne: {mean_val:.2f})")
                elif std_val > mean_val * 0.5:  # High variance
                    characteristics.append(f"Valeurs {feature} variables (écart-type: {std_val:.2f})")
                
                if mean_val > 0:
                    characteristics.append(f"Tendance {feature} élevée")
                elif mean_val < 0:
                    characteristics.append(f"Tendance {feature} faible")
        
        # Analyze categorical patterns
        for feature, values in categorical_features.items():
            counter = Counter(values)
            most_common = counter.most_common(1)[0]
            
            if most_common[1] > len(values) * 0.7:  # Dominant category
                characteristics.append(f"Majorité {feature}: {most_common[0]}")
        
        return characteristics[:5]  # Limit to top 5 characteristics
    
    def _identify_key_features(self, cluster_points: List) -> List[str]:
        """Identify key features that define the cluster."""
        if not cluster_points:
            return []
        
        # Get all features from sample points
        all_features = set()
        for point in cluster_points[:10]:  # Sample first 10 points
            all_features.update(point.original_data.keys())
        
        # For now, return first few features
        # In a more sophisticated implementation, we could use feature importance
        return list(all_features)[:5]
    
    def _get_french_system_prompt(self) -> str:
        """Get French system prompt for AI explanation."""
        return """Tu es un expert en analyse de données et visualisation. Ton rôle est d'expliquer de manière claire et accessible les résultats d'algorithmes de clustering appliqués à des datasets.

Tes explications doivent être :
- Claires et compréhensibles pour un utilisateur non-technique
- Basées sur les données fournies
- Concises (2-3 phrases maximum)
- Orientées insights et patterns
- En français

Évite le jargon technique excessif et concentre-toi sur ce que signifient concrètement les patterns observés."""
    
    def _get_english_system_prompt(self) -> str:
        """Get English system prompt for AI explanation."""
        return """You are a data analysis and visualization expert. Your role is to explain clustering algorithm results on datasets in a clear and accessible way.

Your explanations should be:
- Clear and understandable for non-technical users
- Based on the provided data
- Concise (2-3 sentences maximum)
- Focused on insights and patterns
- In English

Avoid excessive technical jargon and focus on what the observed patterns mean concretely."""
    
    def _create_french_user_prompt(self, context: Dict[str, Any]) -> str:
        """Create French user prompt with context."""
        return f"""Analyse ce cluster de données et fournis une explication claire :

Cluster {context['cluster_id']} :
- Taille : {context['cluster_size']} points ({context['cluster_percentage']}% du dataset)
- Méthode de réduction : {context['reduction_method']}
- Méthode de clustering : {context['clustering_method']}
- Caractéristiques observées : {', '.join(context['characteristics'])}
- Features utilisées : {', '.join(context['features_used'])}

Échantillon de données :
{json.dumps(context['sample_data'][:3], indent=2, ensure_ascii=False)}

Explique en 2-3 phrases ce que représente ce cluster et quels patterns il révèle dans les données."""
    
    def _create_english_user_prompt(self, context: Dict[str, Any]) -> str:
        """Create English user prompt with context."""
        return f"""Analyze this data cluster and provide a clear explanation:

Cluster {context['cluster_id']}:
- Size: {context['cluster_size']} points ({context['cluster_percentage']}% of dataset)
- Reduction method: {context['reduction_method']}
- Clustering method: {context['clustering_method']}
- Observed characteristics: {', '.join(context['characteristics'])}
- Features used: {', '.join(context['features_used'])}

Data sample:
{json.dumps(context['sample_data'][:3], indent=2)}

Explain in 2-3 sentences what this cluster represents and what patterns it reveals in the data."""
    
    def _create_fallback_explanation(self, cluster, language: str) -> ClusterAnalysis:
        """Create fallback explanation when AI is not available."""
        if language == "fr":
            explanation = f"Le cluster {cluster.id} regroupe {cluster.count} points de données qui présentent des caractéristiques similaires dans l'espace de réduction dimensionnelle. Ces points ont été identifiés comme formant un groupe cohérent par l'algorithme de clustering."
            characteristics = ["Points groupés par similarité", "Patron cohérent identifié"]
            key_features = ["Caractéristiques communes"]
        else:
            explanation = f"Cluster {cluster.id} groups {cluster.count} data points that exhibit similar characteristics in the reduced dimensional space. These points were identified as forming a coherent group by the clustering algorithm."
            characteristics = ["Points grouped by similarity", "Coherent pattern identified"]
            key_features = ["Common characteristics"]
        
        return ClusterAnalysis(
            cluster_id=cluster.id,
            explanation=explanation,
            characteristics=characteristics,
            data_points=cluster.count,
            key_features=key_features,
        )
    
    def _generate_fallback_explanations(
        self,
        processing_result: ProcessingResult,
        language: str,
    ) -> List[ClusterAnalysis]:
        """Generate fallback explanations for all clusters."""
        explanations = []
        
        for cluster in processing_result.clusters:
            explanation = self._create_fallback_explanation(cluster, language)
            explanations.append(explanation)
        
        return explanations
    
    async def explain_anomalies(
        self,
        processing_result: ProcessingResult,
        dataset_metadata: Optional[DatasetMetadata] = None,
        language: str = "fr",
    ) -> str:
        """
        Generate explanation for detected anomalies.
        
        Args:
            processing_result: ML processing results
            dataset_metadata: Dataset metadata
            language: Language for explanation
            
        Returns:
            Explanation of anomalies
        """
        if not processing_result.anomalies:
            if language == "fr":
                return "Aucune anomalie détectée dans ce dataset."
            else:
                return "No anomalies detected in this dataset."
        
        anomaly_count = len(processing_result.anomalies)
        total_points = len(processing_result.points)
        percentage = round((anomaly_count / total_points) * 100, 1)
        
        if language == "fr":
            return f"{anomaly_count} anomalies détectées ({percentage}% des données). Ces points présentent des caractéristiques inhabituelles qui les distinguent des patterns principaux du dataset."
        else:
            return f"{anomaly_count} anomalies detected ({percentage}% of data). These points exhibit unusual characteristics that distinguish them from the main patterns in the dataset."
    
    async def generate_dataset_summary(
        self,
        processing_result: ProcessingResult,
        dataset_metadata: Optional[DatasetMetadata] = None,
        language: str = "fr",
    ) -> str:
        """
        Generate overall dataset analysis summary.
        
        Args:
            processing_result: ML processing results
            dataset_metadata: Dataset metadata
            language: Language for summary
            
        Returns:
            Dataset analysis summary
        """
        cluster_count = len(processing_result.clusters)
        anomaly_count = len(processing_result.anomalies)
        total_points = processing_result.metadata.total_points
        
        if language == "fr":
            summary = f"Analyse de {total_points} points de données révélant {cluster_count} groupes distincts"
            if anomaly_count > 0:
                summary += f" et {anomaly_count} anomalies"
            summary += f". Traitement effectué en {processing_result.metadata.processing_time:.1f} secondes avec {processing_result.metadata.reduction_method.upper()} et {processing_result.metadata.clustering_method.upper()}."
        else:
            summary = f"Analysis of {total_points} data points revealing {cluster_count} distinct groups"
            if anomaly_count > 0:
                summary += f" and {anomaly_count} anomalies"
            summary += f". Processing completed in {processing_result.metadata.processing_time:.1f} seconds using {processing_result.metadata.reduction_method.upper()} and {processing_result.metadata.clustering_method.upper()}."
        
        return summary