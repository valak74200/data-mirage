import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Brain, Database, LogOut, User, Settings, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Canvas3DOptimized from "@/components/visualization/canvas-3d-optimized";
import DatasetUpload from "@/components/dataset/dataset-upload";
import MLControls from "@/components/ml/ml-controls";

export default function HomeAuthenticated() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Non autorisé",
        description: "Connexion nécessaire. Redirection...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white flex">
      {/* Side Panel */}
      <motion.div 
        className="w-80 bg-black/20 backdrop-blur-sm border-r border-white/10 flex flex-col"
        initial={{ x: -320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Data Mirage
            </h1>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.href = '/datasets'}
                className="text-gray-300 hover:text-cyan-400"
              >
                <Database className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.href = '/api/logout'}
                className="text-gray-300 hover:text-red-400"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <User className="w-4 h-4" />
            <span>Bonjour, {user ? ((user as any).firstName || (user as any).email) : 'Utilisateur'}</span>
          </div>
        </div>

        {/* Upload Section */}
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            Import de données
          </h2>
          <DatasetUpload 
            onDatasetCreated={(dataset) => {
              setSelectedDataset(dataset);
              toast({
                title: "Dataset créé",
                description: `${dataset.name} est prêt pour l'analyse`,
              });
            }}
          />
        </div>

        {/* ML Controls */}
        {selectedDataset && (
          <div className="p-6 border-b border-white/10 flex-1">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              Configuration ML
            </h2>
            <MLControls 
              dataset={selectedDataset}
              onProcessingComplete={(result) => {
                setProcessingResult(result);
                toast({
                  title: "Analyse terminée",
                  description: "Visualisation 3D générée avec succès",
                });
              }}
            />
          </div>
        )}

        {/* Quick Stats */}
        {processingResult && (
          <motion.div 
            className="p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="text-sm font-semibold text-gray-400 mb-3">STATISTIQUES</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Points:</span>
                <span className="text-cyan-400">{processingResult.points?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Clusters:</span>
                <span className="text-green-400">{processingResult.clusters?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Anomalies:</span>
                <span className="text-red-400">{processingResult.anomalies?.length || 0}</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Main Content */}
      <motion.div 
        className="flex-1 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {/* Top Bar */}
        <div className="p-4 bg-black/10 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold">Visualisation 3D Interactive</h2>
              {selectedDataset && (
                <div className="text-sm text-gray-400">
                  Dataset: <span className="text-cyan-400">{selectedDataset.name}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10"
              >
                <Eye className="w-4 h-4 mr-1" />
                Plein écran
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-gray-300 hover:bg-white/10"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 3D Visualization */}
        <div className="flex-1 relative">
          <Canvas3DOptimized processingResult={processingResult} />
          
          {!selectedDataset && (
            <motion.div 
              className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center max-w-md">
                <motion.div
                  animate={{ y: [-10, 10, -10] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="text-6xl mb-4"
                >
                  🌌
                </motion.div>
                <h3 className="text-2xl font-semibold mb-4 text-white">
                  Prêt pour l'exploration
                </h3>
                <p className="text-gray-300 mb-6">
                  Uploadez un dataset CSV ou JSON pour commencer votre voyage dans l'univers des données
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button 
                    onClick={() => (document.querySelector('input[type="file"]') as HTMLElement)?.click()}
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choisir un fichier
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.location.href = '/datasets'}
                    className="border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Mes datasets
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}