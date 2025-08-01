// Types synchronisés avec les modèles Pydantic FastAPI

// User types (auth)
export interface User {
  id: string;
  email: string;
  name?: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  confirm_password: string;
  name?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// Dataset types (synchronized with FastAPI models)
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

export interface DatasetColumn {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'boolean';
  min?: number;
  max?: number;
  unique_count?: number;
  null_count: number;
  data_type: string;
}

export interface DatasetStats {
  total_rows: number;
  total_columns: number;
  numeric_columns: number;
  categorical_columns: number;
  missing_values: number;
  duplicate_rows: number;
  memory_usage: number;
  file_size: number;
}

export interface DatasetMetadata {
  id: string;
  name: string;
  filename: string;
  size: number;
  created_at: string;
  stats: DatasetStats;
  columns: DatasetColumn[];
  preview: any[];
}

// ML Algorithm types
export interface MLAlgorithm {
  id: string;
  name: string;
  description: string;
  category: 'clustering' | 'dimensionality' | 'anomaly' | 'optimization';
  parameters: Record<string, MLParameter>;
}

export interface MLParameter {
  type: 'int' | 'float' | 'string' | 'bool' | 'select';
  default: any;
  min?: number;
  max?: number;
  options?: string[];
  description: string;
}

export interface MLProcessRequest {
  algorithm_id: string;
  parameters: Record<string, any>;
}

// ML Task types
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
  algorithm_name: string;
  status: string;
  results: {
    processed_data: DataPoint[];
    metadata: MLResultMetadata;
    visualization_config: VisualizationConfig;
    performance_metrics?: Record<string, number>;
  };
  processing_time: number;
  created_at: string;
}

export interface MLResultMetadata {
  algorithm_used: string;
  parameters_used: Record<string, any>;
  data_shape: [number, number];
  feature_names: string[];
  explained_variance_ratio?: number[];
  cluster_centers?: number[][];
  anomaly_scores?: number[];
  optimization_history?: number[];
}

// Visualization types
export interface DataPoint {
  id: string | number;
  x: number;
  y: number;
  z: number;
  cluster?: number;
  anomaly_score?: number;
  original_data: Record<string, any>;
  color?: string;
  size?: number;
  opacity?: number;
}

export interface VisualizationConfig {
  // Dimension reduction
  reduction_method: 'pca' | 'tsne' | 'umap';
  n_components: number;
  
  // Clustering
  clustering_method?: 'kmeans' | 'dbscan' | 'hierarchical';
  n_clusters?: number;
  
  // Visual mapping
  color_column?: string;
  size_column?: string;
  opacity_column?: string;
  
  // Filtering
  filter_ranges?: Record<string, [number, number]>;
  selected_features?: string[];
  
  // Anomaly detection
  detect_anomalies: boolean;
  anomaly_threshold?: number;
  
  // Rendering options
  point_size: number;
  point_opacity: number;
  background_color: string;
  color_scheme: string;
}

export interface ClusterInfo {
  id: number;
  label: string;
  color: string;
  count: number;
  centroid: [number, number, number];
  variance: number;
  density: number;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

export interface ProcessingProgressMessage extends WebSocketMessage {
  type: 'processing_progress';
  data: {
    task_id: string;
    progress: number;
    stage: string;
    estimated_remaining?: number;
  };
}

export interface ProcessingCompleteMessage extends WebSocketMessage {
  type: 'processing_completed';
  data: {
    task_id: string;
    results_url: string;
  };
}

export interface ProcessingErrorMessage extends WebSocketMessage {
  type: 'processing_error';
  data: {
    task_id: string;
    error: string;
    details?: string;
  };
}

// API Response types
export interface APIError {
  detail: string;
  error_code?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  services: Record<string, 'up' | 'down'>;
}

// Utility types
export type DatasetStatus = 'uploading' | 'processing' | 'ready' | 'error';
export type TaskStatus = MLTask['status'];
export type AlgorithmCategory = MLAlgorithm['category'];

// Type guards
export function isDataPoint(obj: any): obj is DataPoint {
  return obj && typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.z === 'number';
}

export function isMLResults(obj: any): obj is MLResults {
  return obj && obj.task_id && obj.results && Array.isArray(obj.results.processed_data);
}

export function isProcessingMessage(msg: WebSocketMessage): msg is ProcessingProgressMessage {
  return msg.type === 'processing_progress' && msg.data?.task_id;
}
