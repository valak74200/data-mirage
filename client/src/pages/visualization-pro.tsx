import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Play, Pause, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DataPoint {
  id: string;
  position: [number, number, number];
  color: string;
  cluster: number;
  originalData: any;
  isAnomaly?: boolean;
}

interface ProcessingResult {
  points: DataPoint[];
  clusters: Array<{
    id: number;
    color: string;
    center: [number, number, number];
    points: string[];
  }>;
  anomalies: string[];
  optimalClusters?: number;
}

interface Dataset {
  id: string;
  name: string;
  uploadedAt: string;
  rowCount: number;
}

interface MLConfig {
  reductionMethod: 'tsne' | 'umap' | 'pca';
  clusteringMethod: 'kmeans' | 'dbscan';
  detectAnomalies: boolean;
  autoCluster: boolean;
}

export default function VisualizationPro() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 3D Visualization state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState({
    rotation: { x: 0.3, y: 0 },
    zoom: 0.8, // Start with smaller zoom for better overview
    autoRotate: true
  });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  
  // ML Configuration
  const [mlConfig, setMLConfig] = useState<MLConfig>({
    reductionMethod: 'tsne',
    clusteringMethod: 'kmeans',
    detectAnomalies: true,
    autoCluster: true
  });

  // Fetch datasets
  const { data: datasets = [] } = useQuery<Dataset[]>({
    queryKey: ['/api/datasets'],
    enabled: !!isAuthenticated,
  });

  // Upload dataset mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reductionMethod', mlConfig.reductionMethod);
      formData.append('clusteringMethod', mlConfig.clusteringMethod);
      formData.append('detectAnomalies', mlConfig.detectAnomalies.toString());
      
      // Don't send numClusters when autoCluster is enabled
      if (!mlConfig.autoCluster) {
        formData.append('numClusters', '3');
      }
      
      const response = await fetch('/api/datasets', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (dataset: Dataset) => {
      setSelectedDataset(dataset);
      queryClient.invalidateQueries({ queryKey: ['/api/datasets'] });
      processDataset(dataset.id);
    },
  });

  // Process dataset mutation
  const processMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      const body: any = {
        reductionMethod: mlConfig.reductionMethod,
        clusteringMethod: mlConfig.clusteringMethod,
        detectAnomalies: mlConfig.detectAnomalies,
      };
      
      // Only send numClusters if autoCluster is disabled
      if (!mlConfig.autoCluster) {
        body.numClusters = 3;
      }
      
      const response = await fetch(`/api/process/${datasetId}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (result: ProcessingResult) => {
      setProcessingResult(result);
      setIsProcessing(false);
    },
    onError: () => {
      setIsProcessing(false);
    },
  });

  const processDataset = (datasetId: string) => {
    setIsProcessing(true);
    setProcessingResult(null);
    processMutation.mutate(datasetId);
  };

  // 3D Projection and rendering
  const project3D = useCallback((x: number, y: number, z: number) => {
    if (!canvasRef.current) return { x: 0, y: 0, size: 4 };
    
    const canvas = canvasRef.current;
    const perspective = 1000;
    const scale = 150 * camera.zoom;
    
    // Apply rotation
    const cosX = Math.cos(camera.rotation.x);
    const sinX = Math.sin(camera.rotation.x);
    const cosY = Math.cos(camera.rotation.y);
    const sinY = Math.sin(camera.rotation.y);
    
    // Rotate around Y axis then X axis
    const rotatedX = x * cosY - z * sinY;
    const rotatedZ = x * sinY + z * cosY;
    const rotatedY = y * cosX - rotatedZ * sinX;
    const finalZ = y * sinX + rotatedZ * cosX;
    
    // Project to 2D
    const projectedX = (rotatedX * perspective) / (perspective + finalZ) * scale + canvas.width / 2;
    const projectedY = (rotatedY * perspective) / (perspective + finalZ) * scale + canvas.height / 2;
    const size = Math.max(2, (perspective) / (perspective + finalZ) * 6);
    
    return { x: projectedX, y: projectedY, size: size, depth: finalZ };
  }, [camera]);

  const drawVisualization = useCallback(() => {
    if (!canvasRef.current || !processingResult?.points) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const points = processingResult.points;
    const spread = 1.5; // Increase spread for better separation

    // Project all points and sort by depth
    const projectedPoints = points.map(point => {
      const projected = project3D(
        point.position[0] * spread,
        point.position[1] * spread,
        point.position[2] * spread
      );
      return { ...point, ...projected };
    }).sort((a, b) => (b.depth || 0) - (a.depth || 0));

    // Draw cluster connections (simplified)
    if (processingResult.clusters) {
      ctx.globalAlpha = 0.15;
      processingResult.clusters.forEach(cluster => {
        const clusterPoints = projectedPoints.filter(p => p.cluster === cluster.id);
        
        if (clusterPoints.length > 1) {
          ctx.strokeStyle = cluster.color;
          ctx.lineWidth = 1;
          
          // Only connect nearby points
          clusterPoints.forEach((point, i) => {
            const nearbyPoints = clusterPoints
              .slice(i + 1, i + 4) // Only next 3 points
              .filter(other => {
                const distance = Math.sqrt(
                  Math.pow(point.position[0] - other.position[0], 2) +
                  Math.pow(point.position[1] - other.position[1], 2) +
                  Math.pow(point.position[2] - other.position[2], 2)
                );
                return distance < 1.5;
              });
            
            nearbyPoints.forEach(nearbyPoint => {
              ctx.beginPath();
              ctx.moveTo(point.x, point.y);
              ctx.lineTo(nearbyPoint.x, nearbyPoint.y);
              ctx.stroke();
            });
          });
        }
      });
      ctx.globalAlpha = 1;
    }

    // Draw points
    projectedPoints.forEach(point => {
      const isSelected = selectedPoint === point.id;
      const isAnomaly = point.isAnomaly;
      
      // Anomaly glow effect (reduced)
      if (isAnomaly) {
        const glowGradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, point.size * 2
        );
        glowGradient.addColorStop(0, '#ff000060');
        glowGradient.addColorStop(1, '#ff000000');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Selection highlight (reduced)
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size + 3, 0, Math.PI * 2);
        ctx.stroke();
        
        // Pulse effect (reduced)
        const pulseSize = point.size + 6 + Math.sin(Date.now() * 0.005) * 2;
        ctx.strokeStyle = '#ffffff40';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, pulseSize, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Main point with depth-based size (reduced effect)
      const depthSize = point.size * (1 + Math.max(0, (point.depth || 0) / 3000));
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, depthSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner highlight (reduced)
      ctx.fillStyle = '#ffffff40';
      ctx.beginPath();
      ctx.arc(
        point.x - depthSize * 0.3, 
        point.y - depthSize * 0.3, 
        depthSize * 0.3, 
        0, Math.PI * 2
      );
      ctx.fill();
      
      // Point border for definition
      ctx.strokeStyle = '#00000040';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, depthSize, 0, Math.PI * 2);
      ctx.stroke();
    });
  }, [processingResult, project3D, selectedPoint]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (camera.autoRotate && !isDragging) {
        setCamera(prev => ({
          ...prev,
          rotation: {
            ...prev.rotation,
            y: prev.rotation.y + 0.005
          }
        }));
      }
      drawVisualization();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [camera.autoRotate, isDragging, drawVisualization]);

  // Canvas interactions
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !processingResult?.points) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for point clicks
    const points = processingResult.points.map(point => {
      const projected = project3D(
        point.position[0],
        point.position[1], 
        point.position[2]
      );
      return { ...point, ...projected };
    });

    for (const point of points) {
      const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
      if (distance <= point.size + 4) {
        setSelectedPoint(selectedPoint === point.id ? null : point.id);
        return;
      }
    }

    // Start dragging
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
    setCamera(prev => ({ ...prev, autoRotate: false }));
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    
    setCamera(prev => ({
      ...prev,
      rotation: {
        x: Math.max(-Math.PI/2, Math.min(Math.PI/2, prev.rotation.x + deltaY * 0.01)),
        y: prev.rotation.y + deltaX * 0.01
      }
    }));
    
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(4, prev.zoom + (e.deltaY > 0 ? -0.1 : 0.1)))
    }));
  };

  // Canvas resize
  useEffect(() => {
    const resizeCanvas = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <Card className="p-8 bg-black/40 backdrop-blur-md border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">Accès requis</h2>
          <p className="text-gray-300 mb-6">Connectez-vous pour accéder à la visualisation 3D</p>
          <Button onClick={() => window.location.href = '/api/login'}>
            Se connecter
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Data Mirage Pro</h1>
            <p className="text-gray-300 text-sm">Visualisation 3D intelligente de données</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">
              {(user as any)?.email || 'Utilisateur'}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/api/logout'}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-88px)]">
        {/* Side Panel */}
        <motion.div 
          className="w-80 bg-black/30 backdrop-blur-md border-r border-white/10 p-6 overflow-y-auto"
          initial={{ x: -320 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Upload Section */}
          <Card className="mb-6 bg-white/5 border-white/10">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">📊 Importer des données</h3>
              
              <input
                type="file"
                accept=".csv,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                }}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button 
                  className="w-full mb-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                  disabled={uploadMutation.isPending}
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadMutation.isPending ? 'Upload...' : 'Choisir un fichier'}
                  </span>
                </Button>
              </label>

              {/* Dataset Selection */}
              {datasets.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Datasets existants</label>
                  <Select 
                    onValueChange={(value) => {
                      const dataset = datasets.find((d: Dataset) => d.id === value);
                      if (dataset) {
                        setSelectedDataset(dataset);
                        processDataset(dataset.id);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-black/20 border-white/20 text-white">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((dataset: Dataset) => (
                        <SelectItem key={dataset.id} value={dataset.id}>
                          {dataset.name} ({dataset.rowCount} lignes)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Card>

          {/* ML Configuration */}
          <Card className="mb-6 bg-white/5 border-white/10">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">🤖 Configuration ML</h3>
              
              {/* Auto Clustering Toggle */}
              <div className="mb-4 p-3 bg-black/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Clusters automatiques
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-cyan-600"
                      checked={mlConfig.autoCluster}
                      onChange={(e) => 
                        setMLConfig(prev => ({ ...prev, autoCluster: e.target.checked }))
                      }
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Détection automatique du nombre optimal de groupes
                </p>
              </div>

              {/* Reduction Method */}
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Réduction dimensionnelle</label>
                <Select 
                  value={mlConfig.reductionMethod}
                  onValueChange={(value: 'tsne' | 'umap' | 'pca') => 
                    setMLConfig(prev => ({ ...prev, reductionMethod: value }))
                  }
                >
                  <SelectTrigger className="bg-black/20 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tsne">t-SNE (Groupes complexes)</SelectItem>
                    <SelectItem value="umap">UMAP (Rapide)</SelectItem>
                    <SelectItem value="pca">PCA (Simple)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clustering Method */}
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Méthode de clustering</label>
                <Select 
                  value={mlConfig.clusteringMethod}
                  onValueChange={(value: 'kmeans' | 'dbscan') => 
                    setMLConfig(prev => ({ ...prev, clusteringMethod: value }))
                  }
                >
                  <SelectTrigger className="bg-black/20 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kmeans">K-Means (Équilibrés)</SelectItem>
                    <SelectItem value="dbscan">DBSCAN (Densité)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Anomaly Detection */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white">
                  Détecter les anomalies
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-red-600"
                    checked={mlConfig.detectAnomalies}
                    onChange={(e) => 
                      setMLConfig(prev => ({ ...prev, detectAnomalies: e.target.checked }))
                    }
                  />
                </label>
              </div>

              {/* Process Button */}
              {selectedDataset && (
                <Button 
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  onClick={() => processDataset(selectedDataset.id)}
                  disabled={isProcessing}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isProcessing ? 'Traitement...' : 'Analyser'}
                </Button>
              )}
            </div>
          </Card>

          {/* Stats */}
          {processingResult && (
            <Card className="bg-white/5 border-white/10">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-4">📈 Statistiques</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Points:</span>
                    <span className="text-cyan-400 font-semibold">
                      {processingResult.points.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Clusters:</span>
                    <span className="text-green-400 font-semibold">
                      {processingResult.clusters.length}
                      {processingResult.optimalClusters && (
                        <span className="text-xs text-gray-400 ml-1">
                          (optimal: {processingResult.optimalClusters})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Anomalies:</span>
                    <span className="text-red-400 font-semibold">
                      {processingResult.anomalies.length}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </motion.div>

        {/* Main Visualization */}
        <div className="flex-1 flex flex-col">
          {/* Canvas Controls */}
          <div className="bg-black/10 backdrop-blur-sm border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-white">Visualisation 3D</h2>
                {selectedDataset && (
                  <span className="text-sm text-gray-300">
                    Dataset: <span className="text-cyan-400">{selectedDataset.name}</span>
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setCamera(prev => ({ ...prev, autoRotate: !prev.autoRotate }))}
                >
                  {camera.autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setCamera({ rotation: { x: 0.3, y: 0 }, zoom: 1.5, autoRotate: true })}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setCamera(prev => ({ ...prev, zoom: Math.min(4, prev.zoom * 1.2) }))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setCamera(prev => ({ ...prev, zoom: Math.max(0.5, prev.zoom / 1.2) }))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative">
            {processingResult ? (
              <>
                <canvas
                  ref={canvasRef}
                  className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                />
                
                {/* Camera Info */}
                <motion.div 
                  className="absolute top-4 right-4 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="text-sm text-white space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Zoom:</span>
                      <span className="text-blue-400">{(camera.zoom * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Rotation:</span>
                      <span className="text-purple-400">
                        {camera.autoRotate ? 'AUTO' : 'MANUEL'}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Point Info Panel */}
                <AnimatePresence>
                  {selectedPoint && (() => {
                    const point = processingResult.points.find(p => p.id === selectedPoint);
                    return point ? (
                      <motion.div 
                        className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-cyan-400/30 max-w-sm"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="text-white">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-lg font-semibold text-cyan-400">Point Data</h4>
                            <button
                              onClick={() => setSelectedPoint(null)}
                              className="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
                            >
                              ×
                            </button>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-300">ID:</span>
                              <span className="text-white font-mono">{point.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">Cluster:</span>
                              <span className="text-green-400 font-semibold">{point.cluster}</span>
                            </div>
                            {point.isAnomaly && (
                              <div className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs border border-red-500/30">
                                🚨 Anomalie détectée
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <h5 className="text-xs font-semibold text-gray-400 mb-2">DONNÉES ORIGINALES</h5>
                            <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                              {Object.entries(point.originalData || {}).slice(0, 8).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-gray-400 truncate">{key}:</span>
                                  <span className="text-white ml-2 truncate">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null;
                  })()}
                </AnimatePresence>

                {/* Controls Info */}
                <motion.div 
                  className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="text-xs text-gray-300 space-y-1">
                    <div>🖱️ Glisser pour tourner</div>
                    <div>🔄 Molette pour zoomer</div>
                    <div>👆 Cliquer sur les points</div>
                    <div>✨ Optimisé pour iPhone</div>
                  </div>
                </motion.div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <motion.div 
                  className="text-center max-w-md"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {isProcessing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="text-6xl mb-6"
                      >
                        ⚙️
                      </motion.div>
                      <h3 className="text-2xl font-semibold mb-4 text-white">
                        Analyse en cours...
                      </h3>
                      <p className="text-gray-300">
                        Traitement ML et génération de la visualisation 3D
                      </p>
                    </>
                  ) : (
                    <>
                      <motion.div
                        animate={{ 
                          scale: [1, 1.1, 1],
                          rotate: [0, 180, 360] 
                        }}
                        transition={{ 
                          duration: 4, 
                          repeat: Infinity, 
                          ease: "easeInOut" 
                        }}
                        className="text-6xl mb-6 text-cyan-400"
                      >
                        🌌
                      </motion.div>
                      <h3 className="text-2xl font-semibold mb-4 text-white">
                        Prêt pour l'exploration
                      </h3>
                      <p className="text-gray-300 leading-relaxed">
                        Importez un dataset CSV ou JSON pour découvrir votre univers de données en 3D avec clustering automatique
                      </p>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}