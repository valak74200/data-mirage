import React, { useState } from "react";
import { motion } from "framer-motion";
import FileUpload from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVisualizationStore } from "@/stores/visualization-store";

export default function SimpleControls() {
  const {
    currentDataset,
    mlConfig,
    setMLConfig,
    processDataset,
    isProcessing,
    processingResult
  } = useVisualizationStore();

  const [clusterCount, setClusterCount] = useState(3);

  const handleProcess = async () => {
    if (!currentDataset) return;
    
    await processDataset(currentDataset.id, {
      ...mlConfig,
      numClusters: clusterCount,
    });
  };

  const availableColumns = (currentDataset?.metadata as any)?.columns || [];

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">📁 Dataset</h2>
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <FileUpload />
          {currentDataset && (
            <div className="mt-3 p-3 bg-gray-700 rounded text-sm">
              <div className="text-green-400 font-medium">{currentDataset.name}</div>
              <div className="text-gray-400 text-xs mt-1">
                Dataset chargé avec succès
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ML Configuration */}
      {currentDataset && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">🤖 Configuration ML</h2>
          
          {/* Reduction Method */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Réduction de dimensions
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Convertit vos données complexes en 3D pour la visualisation
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setMLConfig({ reductionMethod: 'tsne' })}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  mlConfig.reductionMethod === 'tsne'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                t-SNE
              </button>
              <button
                onClick={() => setMLConfig({ reductionMethod: 'umap' })}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  mlConfig.reductionMethod === 'umap'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                UMAP
              </button>
            </div>
          </div>

          {/* Clustering */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Algorithme de groupage
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Trouve automatiquement des groupes similaires dans vos données
            </p>
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setMLConfig({ clusteringMethod: 'kmeans' })}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  mlConfig.clusteringMethod === 'kmeans'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                K-Means
              </button>
              <button
                onClick={() => setMLConfig({ clusteringMethod: 'dbscan' })}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  mlConfig.clusteringMethod === 'dbscan'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                DBSCAN
              </button>
            </div>

            {/* Cluster Count */}
            <div className="space-y-2">
              <label className="text-sm text-gray-300">
                Nombre de groupes: <span className="text-green-400">{clusterCount}</span>
              </label>
              <Slider
                value={[clusterCount]}
                onValueChange={(value) => setClusterCount(value[0])}
                max={10}
                min={2}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Anomaly Detection */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <label className="flex items-center space-x-3">
              <Checkbox 
                checked={mlConfig.detectAnomalies}
                onCheckedChange={(checked) => setMLConfig({ detectAnomalies: !!checked })}
              />
              <div>
                <span className="text-sm font-medium text-gray-300">Détecter les anomalies</span>
                <p className="text-xs text-gray-500">Identifie les données inhabituelles ou suspectes</p>
              </div>
            </label>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleProcess}
            disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
          >
            {isProcessing ? 'Génération en cours...' : 'GÉNÉRER LA VISUALISATION 3D'}
          </Button>
        </motion.div>
      )}

      {/* Results */}
      {processingResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">📊 Résultats</h2>
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Points:</span>
                <span className="text-blue-400 ml-2 font-mono">
                  {processingResult.points?.length || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Clusters:</span>
                <span className="text-green-400 ml-2 font-mono">
                  {processingResult.clusters?.length || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Anomalies:</span>
                <span className="text-red-400 ml-2 font-mono">
                  {processingResult.points?.filter(p => p.isAnomaly).length || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>
                <span className="text-green-400 ml-2 font-mono">OK</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}