import { useState } from "react";
import { motion } from "framer-motion";
import FileUpload from "@/components/ui/file-upload";
import GlassPanel from "@/components/ui/glass-panel";
import NeonButton from "@/components/ui/neon-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useVisualizationStore } from "@/stores/visualization-store";
import DatasetStats from "./dataset-stats";

export default function ControlsPanel() {
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
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-orbitron text-2xl font-bold text-cyan-400 neon-glow mb-2">
          DATA MIRAGE
        </h1>
        <p className="text-sm text-gray-400">3D Intelligent Visualization</p>
      </motion.div>

      {/* Data Import Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-orbitron text-lg font-bold text-green-400 mb-4 flex items-center">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
          DATA IMPORT
        </h2>
        
        <FileUpload />

        {/* Current Dataset Info */}
        {currentDataset && (
          <GlassPanel className="p-3 text-xs mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-violet-400 font-mono">{currentDataset.name}</span>
              <span className="text-green-400">LOADED</span>
            </div>
            <div className="text-gray-400 space-y-1">
              <div>Rows: <span className="text-white">{(currentDataset.metadata as any)?.rowCount}</span></div>
              <div>Columns: <span className="text-white">{(currentDataset.metadata as any)?.columnCount}</span></div>
              <div>Size: <span className="text-white">{Math.round(((currentDataset.metadata as any)?.fileSize || 0) / 1024)} KB</span></div>
            </div>
          </GlassPanel>
        )}
      </motion.div>

      {/* Visualization Controls */}
      {currentDataset && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-orbitron text-lg font-bold text-violet-400 mb-4 flex items-center">
            <span className="w-2 h-2 bg-violet-400 rounded-full mr-2 animate-pulse"></span>
            VISUALIZATION
          </h2>
          
          <div className="space-y-4">
            {/* Color Mapping */}
            <GlassPanel className="p-3">
              <label className="block text-xs text-gray-400 mb-2">COULEURS PAR DONNÉE</label>
              <p className="text-xs text-gray-500 mb-3">Choisissez quelle colonne détermine les couleurs des points</p>
              <Select 
                value={mlConfig.colorColumn} 
                onValueChange={(value) => setMLConfig({ colorColumn: value })}
              >
                <SelectTrigger className="w-full bg-void border-gray-600 focus:border-cyan-400">
                  <SelectValue placeholder="Choisir une colonne" />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map((col: string) => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GlassPanel>

            {/* Size Mapping */}
            <GlassPanel className="p-3">
              <label className="block text-xs text-gray-400 mb-2">TAILLE PAR DONNÉE</label>
              <p className="text-xs text-gray-500 mb-3">Choisissez quelle colonne détermine la taille des points</p>
              <Select 
                value={mlConfig.sizeColumn} 
                onValueChange={(value) => setMLConfig({ sizeColumn: value })}
              >
                <SelectTrigger className="w-full bg-void border-gray-600 focus:border-cyan-400">
                  <SelectValue placeholder="Choisir une colonne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uniform">Taille uniforme</SelectItem>
                  {availableColumns.map((col: string) => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GlassPanel>

            {/* Dimension Reduction Method */}
            <GlassPanel className="p-3">
              <label className="block text-xs text-gray-400 mb-2">RÉDUCTION DE DIMENSIONS</label>
              <p className="text-xs text-gray-500 mb-3">Convertit vos données en 3D pour la visualisation</p>
              <div className="text-xs text-gray-600 mb-2">
                <div>• <strong>t-SNE</strong> : Bon pour découvrir des groupes locaux</div>
                <div>• <strong>UMAP</strong> : Préserve mieux la structure globale</div>
              </div>
              <div className="flex space-x-2">
                <NeonButton
                  variant="cyan"
                  size="sm"
                  active={mlConfig.reductionMethod === 'tsne'}
                  onClick={() => setMLConfig({ reductionMethod: 'tsne' })}
                  className="flex-1"
                >
                  t-SNE
                </NeonButton>
                <NeonButton
                  variant="cyan"
                  size="sm"
                  active={mlConfig.reductionMethod === 'umap'}
                  onClick={() => setMLConfig({ reductionMethod: 'umap' })}
                  className="flex-1"
                >
                  UMAP
                </NeonButton>
              </div>
            </GlassPanel>
          </div>
        </motion.div>
      )}

      {/* Clustering Controls */}
      {currentDataset && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="font-orbitron text-lg font-bold text-green-400 mb-4 flex items-center">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
            CLUSTERING
          </h2>
          
          <div className="space-y-4">
            {/* Algorithm Selection */}
            <GlassPanel className="p-3">
              <label className="block text-xs text-gray-400 mb-2">ALGORITHME DE GROUPAGE</label>
              <p className="text-xs text-gray-500 mb-3">Trouve automatiquement des groupes dans vos données</p>
              <div className="text-xs text-gray-600 mb-2">
                <div>• <strong>K-Means</strong> : Crée des groupes de taille similaire</div>
                <div>• <strong>DBSCAN</strong> : Trouve des groupes de densité différente</div>
              </div>
              <div className="flex space-x-2">
                <NeonButton
                  variant="green"
                  size="sm"
                  active={mlConfig.clusteringMethod === 'kmeans'}
                  onClick={() => setMLConfig({ clusteringMethod: 'kmeans' })}
                  className="flex-1"
                >
                  K-MEANS
                </NeonButton>
                <NeonButton
                  variant="green"
                  size="sm"
                  active={mlConfig.clusteringMethod === 'dbscan'}
                  onClick={() => setMLConfig({ clusteringMethod: 'dbscan' })}
                  className="flex-1"
                >
                  DBSCAN
                </NeonButton>
              </div>
            </GlassPanel>

            {/* Cluster Count */}
            <GlassPanel className="p-3">
              <label className="block text-xs text-gray-400 mb-2">
                NOMBRE DE GROUPES: <span className="text-green-400">{clusterCount}</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">Combien de groupes différents chercher dans vos données</p>
              <Slider
                value={[clusterCount]}
                onValueChange={(value) => setClusterCount(value[0])}
                max={10}
                min={2}
                step={1}
                className="w-full"
              />
            </GlassPanel>

            {/* Anomaly Detection */}
            <GlassPanel className="p-3">
              <label className="flex items-center space-x-2 text-xs">
                <Checkbox 
                  checked={mlConfig.detectAnomalies}
                  onCheckedChange={(checked) => setMLConfig({ detectAnomalies: !!checked })}
                  className="border-gray-600 data-[state=checked]:bg-violet-500"
                />
                <div>
                  <span>DÉTECTER LES ANOMALIES</span>
                  <p className="text-xs text-gray-500 mt-1">Identifie les données inhabituelles ou suspectes</p>
                </div>
              </label>
            </GlassPanel>

            {/* Process Button */}
            <NeonButton
              variant="cyan"
              size="md"
              disabled={isProcessing}
              onClick={handleProcess}
              className="w-full"
            >
              {isProcessing ? 'PROCESSING...' : 'GENERATE 3D VIEW'}
            </NeonButton>
          </div>
        </motion.div>
      )}
    </div>
  );
}
