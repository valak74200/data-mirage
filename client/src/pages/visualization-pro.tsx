import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "wouter";
import { 
  Upload, Play, Pause, RotateCcw, ZoomIn, ZoomOut, Settings, 
  Database, Brain, Eye, User, LogOut, Layers, Cpu, Target,
  BarChart3, TrendingUp, AlertTriangle, Filter
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import Canvas3D from "@/components/Canvas3D";

import { 
  Dataset, 
  MLAlgorithm, 
  MLProcessRequest, 
  MLTask, 
  MLResults,
  DataPoint,
  VisualizationConfig,
  ClusterInfo,
  ProcessingProgressMessage,
  ProcessingCompleteMessage,
  ProcessingErrorMessage,
  WebSocketMessage
} from "@/types/dataset";

// Modern ML Configuration
interface MLConfigState {
  selectedAlgorithm: string;
  parameters: Record<string, any>;
  visualizationSettings: VisualizationConfig;
}

export default function VisualizationProModern() {
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  
  // État principal
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [currentTask, setCurrentTask] = useState<MLTask | null>(null);
  const [mlResults, setMLResults] = useState<MLResults | null>(null);
  const [visualizationData, setVisualizationData] = useState<DataPoint[]>([]);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  
  // Configuration ML
  const [mlConfig, setMLConfig] = useState<MLConfigState>({
    selectedAlgorithm: '',
    parameters: {},
    visualizationSettings: {
      reduction_method: 'tsne',
      n_components: 3,
      clustering_method: 'kmeans',
      n_clusters: 3,
      detect_anomalies: true,
      point_size: 5,
      point_opacity: 0.8,
      background_color: '#0f0f23',
      color_scheme: 'viridis'
    }
  });

  // États UI
  const [activeTab, setActiveTab] = useState('dataset');
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // WebSocket pour les mises à jour en temps réel
  const { isConnected, sendMessage } = useWebSocket({
    enabled: isAuthenticated,
    onMessage: handleWebSocketMessage,
  });

  function handleWebSocketMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'processing_progress':
        const progressMsg = message as ProcessingProgressMessage;
        if (currentTask && progressMsg.data.task_id === currentTask.id) {
          setCurrentTask(prev => prev ? { ...prev, progress: progressMsg.data.progress } : null);
        }
        break;
        
      case 'processing_completed':
        const completeMsg = message as ProcessingCompleteMessage;
        if (currentTask && completeMsg.data.task_id === currentTask.id) {
          // Refetch les résultats
          queryClient.invalidateQueries({ queryKey: queryKeys.mlResults(currentTask.id) });
          setIsProcessing(false);
        }
        break;
        
      case 'processing_error':
        const errorMsg = message as ProcessingErrorMessage;
        if (currentTask && errorMsg.data.task_id === currentTask.id) {
          setIsProcessing(false);
          setCurrentTask(prev => prev ? { ...prev, status: 'failed', error_message: errorMsg.data.error } : null);
        }
        break;
    }
  }

  // Queries
  const { data: datasets = [] } = useQuery({
    queryKey: queryKeys.datasets(),
    queryFn: () => api.datasets.getAll(),
    enabled: isAuthenticated,
  });

  const { data: algorithms = [] } = useQuery({
    queryKey: queryKeys.mlAlgorithms(),
    queryFn: () => api.ml.getAlgorithms(),
    enabled: isAuthenticated,
  });

  const { data: taskResults } = useQuery({
    queryKey: queryKeys.mlResults(currentTask?.id || ''),
    queryFn: () => api.ml.getResults(currentTask!.id),
    enabled: !!currentTask && currentTask.status === 'completed',
    refetchInterval: currentTask?.status === 'running' ? 2000 : false,
  });

  // Mutations
  const processMutation = useMutation({
    mutationFn: ({ datasetId, request }: { datasetId: string; request: MLProcessRequest }) =>
      api.ml.processDataset(datasetId, request),
    onSuccess: (task) => {
      setCurrentTask(task);
      setIsProcessing(true);
      setActiveTab('results');
      
      // Démarrer le polling du statut
      pollTaskStatus(task.id);
    },
    onError: (error) => {
      toast({
        title: "Erreur de traitement",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Polling du statut de la tâche
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      await api.ml.pollTaskStatus(
        taskId,
        (task) => {
          setCurrentTask(task);
          if (task.status === 'completed' || task.status === 'failed') {
            setIsProcessing(false);
          }
        }
      );
    } catch (error) {
      console.error('Polling error:', error);
      setIsProcessing(false);
    }
  }, []);

  // Effets
  useEffect(() => {
    // Vérifier si un dataset est spécifié dans l'URL
    const datasetId = searchParams.get('dataset');
    if (datasetId && datasets.length > 0) {
      const dataset = datasets.find(d => d.id === datasetId);
      if (dataset) {
        setSelectedDataset(dataset);
        setActiveTab('algorithm');
      }
    }
  }, [datasets, searchParams]);

  useEffect(() => {
    // Mettre à jour les données de visualisation quand les résultats ML arrivent
    if (taskResults) {
      setMLResults(taskResults);
      setVisualizationData(taskResults.results.processed_data);
      
      // Extraire les informations de clusters si disponibles
      if (taskResults.results.metadata.cluster_centers) {
        const clusterInfo: ClusterInfo[] = taskResults.results.metadata.cluster_centers.map((center, i) => ({
          id: i,
          label: `Cluster ${i + 1}`,
          color: `hsl(${(i * 360) / taskResults.results.metadata.cluster_centers!.length}, 70%, 60%)`,
          count: taskResults.results.processed_data.filter(p => p.cluster === i).length,
          centroid: center as [number, number, number],
          variance: 0, // À calculer si nécessaire
          density: 0,  // À calculer si nécessaire
        }));
        setClusters(clusterInfo);
      }
    }
  }, [taskResults]);

  // Handlers
  const handleDatasetSelect = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (dataset) {
      setSelectedDataset(dataset);
      setActiveTab('algorithm');
    }
  };

  const handleAlgorithmSelect = (algorithmId: string) => {
    const algorithm = algorithms.find(a => a.id === algorithmId);
    if (algorithm) {
      setMLConfig(prev => ({
        ...prev,
        selectedAlgorithm: algorithmId,
        parameters: Object.keys(algorithm.parameters).reduce((acc, key) => {
          acc[key] = algorithm.parameters[key].default;
          return acc;
        }, {} as Record<string, any>)
      }));
    }
  };

  const handleStartProcessing = () => {
    if (!selectedDataset || !mlConfig.selectedAlgorithm) {
      toast({
        title: "Configuration incomplète",
        description: "Veuillez sélectionner un dataset et un algorithme",
        variant: "destructive",
      });
      return;
    }

    const request: MLProcessRequest = {
      algorithm_id: mlConfig.selectedAlgorithm,
      parameters: {
        ...mlConfig.parameters,
        ...mlConfig.visualizationSettings
      }
    };

    processMutation.mutate({ datasetId: selectedDataset.id, request });
  };

  const handlePointClick = (point: DataPoint) => {
    setSelectedPoint(point);
  };

  const handleVisualizationSettingChange = (key: keyof VisualizationConfig, value: any) => {
    setMLConfig(prev => ({
      ...prev,
      visualizationSettings: {
        ...prev.visualizationSettings,
        [key]: value
      }
    }));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-white"
        >
          <Brain className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
          <h2 className="text-2xl font-bold mb-2">Authentification requise</h2>
          <p className="text-gray-300 mb-6">Connectez-vous pour accéder à la visualisation 3D intelligente</p>
          <Button onClick={() => window.location.href = '/'} className="bg-gradient-to-r from-cyan-500 to-purple-500">
            Se connecter
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Navigation Header */}
      <motion.nav 
        className="p-4 flex justify-between items-center backdrop-blur-sm bg-black/20 border-b border-white/10"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Brain className="w-8 h-8 text-cyan-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Data Mirage Pro
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/dashboard'}
              className="text-gray-300 hover:text-white"
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualisation
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/datasets'}
              className="text-gray-300 hover:text-white"
            >
              <Database className="w-4 h-4 mr-2" />
              Datasets
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {isConnected && (
            <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
              Connected
            </Badge>
          )}
          
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <User className="w-4 h-4" />
            <span>{user?.name || user?.email}</span>
          </div>
          
          <Button 
            onClick={logout}
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-red-400"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </motion.nav>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar gauche - Configuration */}
        <motion.div 
          className="w-80 bg-black/20 backdrop-blur-sm border-r border-white/10 overflow-y-auto"
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
                <TabsTrigger value="dataset" className="text-xs">Dataset</TabsTrigger>
                <TabsTrigger value="algorithm" className="text-xs">Algorithm</TabsTrigger>
                <TabsTrigger value="results" className="text-xs">Results</TabsTrigger>
              </TabsList>
              
              {/* Tab Dataset */}
              <TabsContent value="dataset" className="space-y-4 mt-4">
                <Card className="bg-gray-800/30 border-gray-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      Sélectionner un Dataset
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select onValueChange={handleDatasetSelect} value={selectedDataset?.id || ''}>
                      <SelectTrigger className="bg-gray-700/50 border-gray-600">
                        <SelectValue placeholder="Choisir un dataset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {datasets.map((dataset) => (
                          <SelectItem key={dataset.id} value={dataset.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{dataset.name}</span>
                              <span className="text-xs text-gray-400">
                                {dataset.row_count} rows × {dataset.column_count} cols
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedDataset && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20"
                      >
                        <h4 className="font-medium text-cyan-300 mb-2">{selectedDataset.name}</h4>
                        <div className="text-xs text-gray-300 space-y-1">
                          <div>📊 {selectedDataset.row_count.toLocaleString()} lignes</div>
                          <div>📈 {selectedDataset.column_count} colonnes</div>
                          <div>💾 {(selectedDataset.size / 1024 / 1024).toFixed(2)} MB</div>
                          <div>📅 {new Date(selectedDataset.created_at).toLocaleDateString()}</div>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Tab Algorithm */}
              <TabsContent value="algorithm" className="space-y-4 mt-4">
                <Card className="bg-gray-800/30 border-gray-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      Algorithme ML
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select onValueChange={handleAlgorithmSelect} value={mlConfig.selectedAlgorithm}>
                      <SelectTrigger className="bg-gray-700/50 border-gray-600">
                        <SelectValue placeholder="Choisir un algorithme..." />
                      </SelectTrigger>
                      <SelectContent>
                        {algorithms.map((algo) => (
                          <SelectItem key={algo.id} value={algo.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{algo.name}</span>
                              <span className="text-xs text-gray-400 capitalize">{algo.category}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Paramètres de l'algorithme */}
                    {mlConfig.selectedAlgorithm && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3"
                      >
                        <Separator className="bg-gray-600/50" />
                        <h5 className="text-sm font-medium text-gray-300">Paramètres</h5>
                        
                        {/* Configuration de visualisation */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Méthode de réduction</label>
                            <Select 
                              value={mlConfig.visualizationSettings.reduction_method}
                              onValueChange={(value: any) => handleVisualizationSettingChange('reduction_method', value)}
                            >
                              <SelectTrigger className="bg-gray-700/50 border-gray-600 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pca">PCA</SelectItem>
                                <SelectItem value="tsne">t-SNE</SelectItem>
                                <SelectItem value="umap">UMAP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-gray-400">Détection d'anomalies</label>
                            <Switch 
                              checked={mlConfig.visualizationSettings.detect_anomalies}
                              onCheckedChange={(checked) => handleVisualizationSettingChange('detect_anomalies', checked)}
                            />
                          </div>
                          
                          <Button
                            onClick={handleStartProcessing}
                            disabled={!selectedDataset || !mlConfig.selectedAlgorithm || isProcessing}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                          >
                            {isProcessing ? (
                              <>
                                <Cpu className="w-4 h-4 mr-2 animate-spin" />
                                Traitement...
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Démarrer l'analyse
                              </>
                            )}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Tab Results */}
              <TabsContent value="results" className="space-y-4 mt-4">
                <Card className="bg-gray-800/30 border-gray-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-green-400" />
                      Résultats ML
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {currentTask && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Statut</span>
                          <Badge 
                            variant={currentTask.status === 'completed' ? 'default' : 'secondary'}
                            className={
                              currentTask.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                              currentTask.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                              'bg-yellow-500/20 text-yellow-300'
                            }
                          >
                            {currentTask.status}
                          </Badge>
                        </div>
                        
                        {currentTask.progress !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Progrès</span>
                              <span className="text-cyan-300">{currentTask.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <motion.div 
                                className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${currentTask.progress || 0}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {mlResults && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                      >
                        <Separator className="bg-gray-600/50" />
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-gray-700/30 p-2 rounded">
                            <div className="text-gray-400">Points</div>
                            <div className="font-medium">{visualizationData.length}</div>
                          </div>
                          <div className="bg-gray-700/30 p-2 rounded">
                            <div className="text-gray-400">Clusters</div>
                            <div className="font-medium">{clusters.length}</div>
                          </div>
                        </div>
                        
                        {clusters.length > 0 && (
                          <div className="space-y-2">
                            <h6 className="text-xs font-medium text-gray-300">Clusters</h6>
                            {clusters.map((cluster) => (
                              <div key={cluster.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: cluster.color }}
                                  />
                                  <span>{cluster.label}</span>
                                </div>
                                <span className="text-gray-400">{cluster.count} pts</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>

        {/* Zone principale - Visualisation 3D */}
        <div className="flex-1 relative">
          <motion.div 
            className="h-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            {visualizationData.length > 0 ? (
              <Canvas3D
                data={visualizationData}
                clusters={clusters}
                config={mlConfig.visualizationSettings}
                selectedPoint={selectedPoint}
                onPointClick={handlePointClick}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <Layers className="w-24 h-24 text-gray-600 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold mb-2 text-gray-300">Visualisation 3D Intelligente</h3>
                  <p className="text-gray-400 mb-6 max-w-md">
                    Sélectionnez un dataset et lancez l'analyse ML pour voir vos données prendre vie en 3D
                  </p>
                  
                  {!selectedDataset ? (
                    <Button 
                      onClick={() => setActiveTab('dataset')}
                      className="bg-gradient-to-r from-cyan-500 to-purple-500"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      Choisir un dataset
                    </Button>
                  ) : !mlConfig.selectedAlgorithm ? (
                    <Button 
                      onClick={() => setActiveTab('algorithm')}
                      className="bg-gradient-to-r from-purple-500 to-pink-500"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Choisir un algorithme
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleStartProcessing}
                      disabled={isProcessing}
                      className="bg-gradient-to-r from-green-500 to-blue-500"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Lancer l'analyse
                    </Button>
                  )}
                </motion.div>
              </div>
            )}
          </motion.div>
          
          {/* Panel d'informations sur le point sélectionné */}
          <AnimatePresence>
            {selectedPoint && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 w-80"
              >
                <Card className="bg-black/80 backdrop-blur-sm border-cyan-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-cyan-400" />
                        Point sélectionné
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedPoint(null)}
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">ID:</span>
                        <span className="font-mono">{selectedPoint.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Position:</span>
                        <span className="font-mono">
                          ({selectedPoint.x.toFixed(2)}, {selectedPoint.y.toFixed(2)}, {selectedPoint.z.toFixed(2)})
                        </span>
                      </div>
                      {selectedPoint.cluster !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Cluster:</span>
                          <span>{selectedPoint.cluster}</span>
                        </div>
                      )}
                      {selectedPoint.anomaly_score !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Anomalie:</span>
                          <span className={selectedPoint.anomaly_score > 0.5 ? 'text-red-400' : 'text-green-400'}>
                            {(selectedPoint.anomaly_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      
                      {selectedPoint.original_data && (
                        <div className="mt-3">
                          <h6 className="text-gray-400 mb-1">Données originales:</h6>
                          <div className="max-h-32 overflow-y-auto bg-gray-800/50 p-2 rounded text-xs">
                            {Object.entries(selectedPoint.original_data).slice(0, 5).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-400">{key}:</span>
                                <span className="font-mono">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}