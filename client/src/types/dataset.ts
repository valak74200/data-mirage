export interface DatasetMetadata {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: string[];
  uploadedAt: string;
}

export interface DatasetColumn {
  name: string;
  type: 'number' | 'string' | 'boolean';
  min?: number;
  max?: number;
  unique?: number;
  nullCount: number;
}

export interface DatasetStats {
  totalRows: number;
  totalColumns: number;
  numericColumns: number;
  categoricalColumns: number;
  missingValues: number;
  duplicateRows: number;
}

export interface VisualizationConfig {
  colorColumn?: string;
  sizeColumn?: string;
  opacityColumn?: string;
  reductionMethod: 'tsne' | 'umap';
  clusteringMethod: 'kmeans' | 'dbscan';
  numClusters: number;
  detectAnomalies: boolean;
  filterRanges: Record<string, [number, number]>;
}

export interface ClusterInfo {
  id: number;
  color: string;
  count: number;
  label: string;
  centroid: [number, number, number];
}
