export interface ProcessingResult {
  points: Array<{
    id: string;
    position: [number, number, number];
    color: string;
    cluster: number;
    originalData: any;
  }>;
  clusters: Array<{
    id: number;
    color: string;
    center: [number, number, number];
    points: string[];
  }>;
  anomalies: string[];
  explanations?: ClusterAnalysis[];
}

export interface ClusterAnalysis {
  clusterId: number;
  explanation: string;
  characteristics: string[];
  dataPoints: number;
  keyFeatures: string[];
}

export interface Dataset {
  id: string;
  name: string;
  originalData: any[];
  metadata: {
    fileName: string;
    fileSize: number;
    rowCount: number;
    columnCount: number;
    columns: string[];
    uploadedAt: string;
  };
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DataPoint {
  id: string;
  position: [number, number, number];
  color: string;
  cluster: number;
  originalData: any;
  isAnomaly?: boolean;
  originalIndex?: number;
}

export interface MLConfig {
  algorithm: string;
  parameters: Record<string, any>;
  numClusters?: number;
  colorColumn?: string;
  sizeColumn?: string;
  reductionMethod?: string;
  clusteringMethod?: string;
  detectAnomalies?: boolean;
}

export interface MLResults {
  algorithm_name: string;
  points: DataPoint[];
  clusters: Array<{
    id: number;
    color: string;
    center: [number, number, number];
    points: string[];
  }>;
  anomalies?: string[];
  processing_time?: number;
}