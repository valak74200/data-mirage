import { ProcessingResult, ClusterAnalysis } from "../../shared/types";

// ClusterAnalysis interface is now imported from shared/types

export class RAGService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY!;
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required');
    }
  }

  async explainClusters(processingResult: ProcessingResult, datasetMetadata: any): Promise<ClusterAnalysis[]> {
    const analyses: ClusterAnalysis[] = [];

    for (const cluster of processingResult.clusters) {
      try {
        const clusterPoints = processingResult.points.filter(p => p.cluster === cluster.id);
        const explanation = await this.generateClusterExplanation(cluster, clusterPoints, datasetMetadata);
        
        analyses.push({
          clusterId: cluster.id,
          explanation: explanation.explanation,
          characteristics: explanation.characteristics,
          dataPoints: clusterPoints.length,
          keyFeatures: explanation.keyFeatures
        });
      } catch (error) {
        console.error(`Error analyzing cluster ${cluster.id}:`, error);
        const clusterPoints = processingResult.points.filter(p => p.cluster === cluster.id);
        analyses.push({
          clusterId: cluster.id,
          explanation: `Cluster ${cluster.id} contient ${clusterPoints.length} points de données avec des caractéristiques similaires.`,
          characteristics: ['Données groupées par similarité', 'Analyse en cours'],
          dataPoints: clusterPoints.length,
          keyFeatures: ['Caractéristiques communes', 'Patron identifié']
        });
      }
    }

    return analyses;
  }

  private async generateClusterExplanation(cluster: any, clusterPoints: any[], datasetMetadata: any) {
    // Analyser les caractéristiques statistiques du cluster
    const features = this.extractClusterFeatures(clusterPoints, datasetMetadata);
    
    // Construire le prompt pour l'IA
    const prompt = this.buildAnalysisPrompt(cluster, features, datasetMetadata);
    
    // Appeler Perplexity API
    const response = await this.callPerplexityAPI(prompt);
    
    return this.parseResponse(response);
  }

  private extractClusterFeatures(clusterPoints: any[], datasetMetadata: any) {
    const features: any = {};
    
    if (!datasetMetadata.columns || clusterPoints.length === 0) {
      return features;
    }

    // Analyser chaque colonne numérique
    datasetMetadata.columns.forEach((column: string) => {
      const values = clusterPoints
        .map(p => p.originalData?.[column])
        .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
        .map(v => Number(v));

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const sorted = values.sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...values);
        const max = Math.max(...values);

        features[column] = {
          moyenne: mean.toFixed(2),
          médiane: median.toFixed(2),
          minimum: min.toFixed(2),
          maximum: max.toFixed(2),
          étendue: (max - min).toFixed(2)
        };
      }
    });

    return features;
  }

  private buildAnalysisPrompt(cluster: any, features: any, datasetMetadata: any) {
    const featureDescriptions = Object.entries(features)
      .map(([column, stats]: [string, any]) => 
        `${column}: moyenne ${stats.moyenne}, médiane ${stats.médiane}, étendue ${stats.étendue}`
      )
      .join(', ');

    return `Tu es un expert en analyse de données. Analyse ce cluster de données et explique-le en français simple pour des débutants.

Dataset: ${datasetMetadata.fileName || 'données'}
Cluster ${cluster.id}: ${cluster.count || 'plusieurs'} points de données
Caractéristiques statistiques: ${featureDescriptions}

Explique en 2-3 phrases courtes:
1. Ce que représente ce groupe de données
2. Ses caractéristiques principales
3. Pourquoi ces points sont regroupés ensemble

Réponds uniquement en français, de manière simple et compréhensible.`;
  }

  private async callPerplexityAPI(prompt: string) {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en analyse de données qui explique les résultats en français simple pour des débutants en machine learning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    return await response.json();
  }

  private parseResponse(response: any) {
    const content = response.choices?.[0]?.message?.content || '';
    
    // Extraire les informations clés de la réponse
    const explanation = content.trim();
    
    // Identifier les caractéristiques mentionnées
    const characteristics = this.extractCharacteristics(content);
    
    // Identifier les features clés
    const keyFeatures = this.extractKeyFeatures(content);

    return {
      explanation,
      characteristics,
      keyFeatures
    };
  }

  private extractCharacteristics(content: string): string[] {
    const characteristics: string[] = [];
    
    // Mots-clés pour identifier les caractéristiques
    const patterns = [
      /valeurs? (élevées?|hautes?|importantes?)/i,
      /valeurs? (faibles?|basses?|petites?)/i,
      /tendance (croissante|décroissante|stable)/i,
      /corrélation (positive|négative|forte|faible)/i,
      /concentrés? (autour|près|vers)/i,
      /dispersés?/i,
      /homogènes?/i,
      /hétérogènes?/i
    ];

    patterns.forEach(pattern => {
      const match = content.match(pattern);
      if (match) {
        characteristics.push(match[0]);
      }
    });

    // Ajouter des caractéristiques par défaut si aucune trouvée
    if (characteristics.length === 0) {
      characteristics.push('Données groupées par similarité', 'Caractéristiques communes identifiées');
    }

    return characteristics.slice(0, 4); // Limiter à 4 caractéristiques
  }

  private extractKeyFeatures(content: string): string[] {
    const features: string[] = [];
    
    // Rechercher des mentions de variables ou caractéristiques
    const words = content.split(/\s+/);
    const keywords = ['moyenne', 'médiane', 'maximum', 'minimum', 'étendue', 'variance', 'tendance', 'patron'];
    
    keywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        features.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });

    // Ajouter des features par défaut si aucune trouvée
    if (features.length === 0) {
      features.push('Patron identifié', 'Structure commune');
    }

    return features.slice(0, 3); // Limiter à 3 features
  }
}