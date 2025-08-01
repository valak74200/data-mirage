import React, { useState, useCallback, createContext, useContext, ReactNode } from "react";
import { Dataset, ProcessingResult, DataPoint, MLConfig } from "@shared/types";
import { DatasetAPI, MLAPI } from "@/lib/api";

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

type VisualizationStore = VisualizationState & VisualizationActions;

const initialState: VisualizationState = {
  currentDataset: null,
  processingResult: null,
  hoveredPoint: null,
  isUploading: false,
  isProcessing: false,
  cameraReset: false,
  mlConfig: {
    algorithm: 'tsne',
    parameters: {},
    reductionMethod: 'tsne',
    clusteringMethod: 'kmeans',
    numClusters: 3,
    detectAnomalies: true,
  },
};

const VisualizationContext = createContext<VisualizationStore | null>(null);

export function VisualizationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VisualizationState>(initialState);

  const uploadDataset = useCallback(async (file: File): Promise<Dataset> => {
    setState(prev => ({ ...prev, isUploading: true }));
    try {
      const dataset = await DatasetAPI.upload({
        name: file.name,
        file: file,
      });
      setState(prev => ({ ...prev, currentDataset: dataset, isUploading: false }));
      return dataset;
    } catch (error) {
      console.error('Upload error:', error);
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
      // Convert the current MLConfig structure to the expected MLProcessRequest format
      const request = {
        algorithm_id: config.algorithm || config.reductionMethod || 'tsne',
        parameters: {
          ...config.parameters,
          reduction_method: config.reductionMethod,
          clustering_method: config.clusteringMethod,
          num_clusters: config.numClusters,
          detect_anomalies: config.detectAnomalies,
          color_column: config.colorColumn,
          size_column: config.sizeColumn,
        },
      };

      const task = await MLAPI.processDataset(datasetId, request);
      
      // Poll for results
      const completedTask = await MLAPI.pollTaskStatus(task.id, (task) => {
        // Update progress if needed
        console.log('Processing progress:', task.progress);
      });

      if (completedTask.status === 'completed') {
        const results = await MLAPI.getResults(completedTask.id);
        setState(prev => ({ 
          ...prev, 
          processingResult: {
            points: results.results.processed_data,
            clusters: results.results.metadata.clusters || [],
            anomalies: results.results.metadata.anomalies || [],
            explanations: results.results.metadata.explanations || [],
          }, 
          isProcessing: false 
        }));
      } else {
        throw new Error(completedTask.error_message || 'Processing failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
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

  const store: VisualizationStore = {
    ...state,
    uploadDataset,
    setCurrentDataset,
    setMLConfig,
    processDataset,
    setHoveredPoint,
    resetCamera,
    setCameraReset,
  };

  return (
    <VisualizationContext.Provider value={store}>
      {children}
    </VisualizationContext.Provider>
  );
}

export function useVisualizationStore(): VisualizationStore {
  const context = useContext(VisualizationContext);
  if (!context) {
    throw new Error('useVisualizationStore must be used within VisualizationProvider');
  }
  return context;
}