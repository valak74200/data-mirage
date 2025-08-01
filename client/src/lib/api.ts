import { authAPI } from "./auth";
import { apiRequest } from "./queryClient";

// Types pour les services API
export interface Dataset {
  id: string;
  name: string;
  filename: string;
  size: number;
  created_at: string;
  user_id: string;
  column_count: number;
  row_count: number;
  columns: string[];
  preview?: any[];
}

export interface DatasetUpload {
  name: string;
  file: File;
}

export interface MLAlgorithm {
  id: string;
  name: string;
  description: string;
  category: 'clustering' | 'dimensionality' | 'anomaly' | 'optimization';
  parameters: Record<string, any>;
}

export interface MLProcessRequest {
  algorithm_id: string;
  parameters: Record<string, any>;
}

export interface MLTask {
  id: string;
  dataset_id: string;
  algorithm_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: number;
  error_message?: string;
}

export interface MLResults {
  task_id: string;
  algorithm_id: string;
  status: string;
  results: {
    processed_data: any[];
    metadata: Record<string, any>;
    visualization_config: Record<string, any>;
  };
  processing_time: number;
  created_at: string;
}

// Service Datasets
export class DatasetAPI {
  static async getAll(): Promise<Dataset[]> {
    const response = await authAPI.makeAuthenticatedRequest('/api/datasets');
    if (!response.ok) {
      throw new Error('Failed to fetch datasets');
    }
    return response.json();
  }

  static async getById(id: string): Promise<Dataset> {
    const response = await authAPI.makeAuthenticatedRequest(`/api/datasets/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch dataset');
    }
    return response.json();
  }

  static async upload(upload: DatasetUpload): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', upload.file);
    formData.append('name', upload.name);

    const response = await authAPI.makeAuthenticatedRequest('/api/datasets/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Ne pas définir Content-Type pour FormData, le navigateur le fera automatiquement
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to upload dataset');
    }

    return response.json();
  }

  static async delete(id: string): Promise<void> {
    const response = await authAPI.makeAuthenticatedRequest(`/api/datasets/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete dataset');
    }
  }

  // Méthode utilitaire pour obtenir l'URL de prévisualisation des données
  static getPreviewUrl(id: string): string {
    const baseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';
    return `${baseUrl}/api/datasets/${id}/preview`;
  }
}

// Service ML (Machine Learning)
export class MLAPI {
  static async getAlgorithms(): Promise<MLAlgorithm[]> {
    const response = await authAPI.makeAuthenticatedRequest('/api/ml/algorithms');
    if (!response.ok) {
      throw new Error('Failed to fetch ML algorithms');
    }
    return response.json();
  }

  static async processDataset(datasetId: string, request: MLProcessRequest): Promise<MLTask> {
    const response = await authAPI.makeAuthenticatedRequest(`/api/ml/process/${datasetId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to start ML processing');
    }

    return response.json();
  }

  static async getTaskStatus(taskId: string): Promise<MLTask> {
    const response = await authAPI.makeAuthenticatedRequest(`/api/ml/status/${taskId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch task status');
    }
    return response.json();
  }

  static async getResults(taskId: string): Promise<MLResults> {
    const response = await authAPI.makeAuthenticatedRequest(`/api/ml/results/${taskId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch ML results');
    }
    return response.json();
  }

  // Méthode utilitaire pour polling du statut d'une tâche
  static async pollTaskStatus(
    taskId: string,
    onProgress?: (task: MLTask) => void,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<MLTask> {
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const task = await this.getTaskStatus(taskId);
          
          onProgress?.(task);
          
          if (task.status === 'completed' || task.status === 'failed') {
            resolve(task);
            return;
          }
          
          if (attempts >= maxAttempts) {
            reject(new Error('Polling timeout: Task did not complete in time'));
            return;
          }
          
          attempts++;
          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }
}

// Service utilitaire pour les opérations communes
export class APIUtils {
  // Vérifier la santé de l'API
  static async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const baseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';
    const response = await fetch(`${baseUrl}/health`);
    
    if (!response.ok) {
      throw new Error('API health check failed');
    }
    
    return response.json();
  }

  // Obtenir les informations de version de l'API
  static async getVersion(): Promise<{ version: string; build: string }> {
    const baseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';
    const response = await fetch(`${baseUrl}/version`);
    
    if (!response.ok) {
      throw new Error('Failed to get API version');
    }
    
    return response.json();
  }

  // Utilitaire pour télécharger des fichiers depuis l'API
  static async downloadFile(url: string, filename: string): Promise<void> {
    const response = await authAPI.makeAuthenticatedRequest(url);
    
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Utilitaire pour formater les erreurs API
  static formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object' && 'detail' in error) {
      return String((error as any).detail);
    }
    
    return 'An unexpected error occurred';
  }
}

// Export par défaut de tous les services
export const api = {
  auth: authAPI,
  datasets: DatasetAPI,
  ml: MLAPI,
  utils: APIUtils,
} as const;