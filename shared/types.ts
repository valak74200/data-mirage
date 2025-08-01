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