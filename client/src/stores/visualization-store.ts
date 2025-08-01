import { useState, useCallback } from "react";
import { Dataset, MLConfig, ProcessingResult, DataPoint } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface VisualizationState {
  currentDataset: Dataset | null;
  processingResult: ProcessingResult | null;
  hoveredPoint: DataPoint | null;
  isUploading: boolean;
  isProcessing: boolean;
  cameraReset: boolean;
  mlConfig: MLConfig;
}

interface VisualizationActions {
  uploadDataset: (file: File) => Promise<Dataset>;
  setCurrentDataset: (dataset: Dataset | null) => void;
  setMLConfig: (config: Partial<MLConfig>) => void;
  processDataset: (datasetId: string, config: MLConfig) => Promise<void>;
  setHoveredPoint: (point: DataPoint | null) => void;
  resetCamera: () => void;
  setCameraReset: (reset: boolean) => void;
}

const initialState: VisualizationState = {
  currentDataset: null,
  processingResult: null,
  hoveredPoint: null,
  isUploading: false,
  isProcessing: false,
  cameraReset: false,
  mlConfig: {
    reductionMethod: 'tsne',
    clusteringMethod: 'kmeans',
    numClusters: 3,
    detectAnomalies: true,
  },
};

export function useVisualizationStore() {
  const [state, setState] = useState<VisualizationState>(initialState);

  const uploadDataset = useCallback(async (file: File): Promise<Dataset> => {
    setState(prev => ({ ...prev, isUploading: true }));
    try {
      const fileContent = await file.text();
      const payload = {
        fileName: file.name,
        fileContent,
        mimeType: file.type,
      };
      
      const response = await apiRequest('POST', '/api/datasets', payload);
      const dataset = await response.json();
      
      console.log('Dataset uploaded successfully:', dataset);
      setState(prev => ({ ...prev, currentDataset: dataset, isUploading: false }));
      return dataset;
    } catch (error) {
      setState(prev => ({ ...prev, isUploading: false }));
      throw error;
    }
  }, []);

  const setCurrentDataset = useCallback((dataset: Dataset | null) => {
    setState(prev => ({ ...prev, currentDataset: dataset, processingResult: null }));
  }, []);

  const setMLConfig = useCallback((config: Partial<MLConfig>) => {
    setState(prev => ({ ...prev, mlConfig: { ...prev.mlConfig, ...config } }));
  }, []);

  const processDataset = useCallback(async (datasetId: string, config: MLConfig) => {
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      const response = await apiRequest('POST', `/api/process/${datasetId}`, config);
      const result = await response.json();
      
      setState(prev => ({ ...prev, processingResult: result, isProcessing: false }));
    } catch (error) {
      setState(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  }, []);

  const setHoveredPoint = useCallback((point: DataPoint | null) => {
    setState(prev => ({ ...prev, hoveredPoint: point }));
  }, []);

  const resetCamera = useCallback(() => {
    setState(prev => ({ ...prev, cameraReset: true }));
  }, []);

  const setCameraReset = useCallback((reset: boolean) => {
    setState(prev => ({ ...prev, cameraReset: reset }));
  }, []);

  // Debug logs
  console.log('Store state - currentDataset:', state.currentDataset);

  return {
    ...state,
    uploadDataset,
    setCurrentDataset,
    setMLConfig,
    processDataset,
    setHoveredPoint,
    resetCamera,
    setCameraReset,
  };
}
