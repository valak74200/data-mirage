import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Database, Calendar, Eye, Trash2, Upload, LogOut, User, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Dataset, DatasetUpload } from "@/types/dataset";
import { Link } from "wouter";

export default function Datasets() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState<string>('');

  // Query pour récupérer tous les datasets
  const { data: datasets, isLoading, error } = useQuery({
    queryKey: queryKeys.datasets(),
    queryFn: () => api.datasets.getAll(),
    enabled: isAuthenticated,
  });

  // Mutation pour l'upload de datasets
  const uploadMutation = useMutation({
    mutationFn: (upload: DatasetUpload) => api.datasets.upload(upload),
    onSuccess: (newDataset) => {
      // Invalider et refetch les datasets
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets() });
      
      setSelectedFile(null);
      setDatasetName('');
      
      toast({
        title: "Dataset uploadé avec succès",
        description: `${newDataset.name} a été analysé et est prêt pour la visualisation`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur d'upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer un dataset
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.datasets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets() });
      toast({
        title: "Dataset supprimé",
        description: "Le dataset a été supprimé avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de suppression",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    const name = datasetName.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
    
    uploadMutation.mutate({
      name,
      file: selectedFile,
    });
  };

  const handleDeleteDataset = (dataset: Dataset) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le dataset "${dataset.name}" ? Cette action est irréversible.`)) {
      deleteMutation.mutate(dataset.id);
    }
  };

  // Gérer les erreurs d'authentification
  useEffect(() => {
    if (error && error.message.includes('No valid authentication tokens')) {
      toast({
        title: "Session expirée",
        description: "Veuillez vous reconnecter",
        variant: "destructive",
      });
    }
  }, [error, toast]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Navigation */}
      <motion.nav 
        className="p-6 flex justify-between items-center backdrop-blur-sm bg-black/20 border-b border-white/10"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Database className="w-8 h-8 text-cyan-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Mes Datasets
            </span>
          </div>
          
          <Button 
            onClick={() => window.location.href = '/dashboard'}
            variant="ghost"
            className="text-gray-300 hover:text-white"
          >
            Visualisation 3D
          </Button>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <User className="w-4 h-4" />
            <span>{user ? (user.name || user.email) : 'Utilisateur'}</span>
          </div>
          <Button 
            onClick={logout}
            variant="ghost"
            className="text-gray-300 hover:text-red-400"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </motion.nav>

      <div className="container mx-auto px-6 py-8">
        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <Card className="bg-black/20 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Upload className="w-5 h-5 text-cyan-400" />
                Nouveau Dataset
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300 font-medium">Nom du dataset</label>
                    <input
                      type="text"
                      placeholder="Nom personnalisé (optionnel)"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300 font-medium">Fichier</label>
                    <label className="block">
                      <input
                        type="file"
                        accept=".csv,.json,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedFile(file);
                          if (file && !datasetName) {
                            setDatasetName(file.name.replace(/\.[^/.]+$/, ''));
                          }
                        }}
                        className="block w-full text-sm text-gray-300
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:bg-gradient-to-r file:from-cyan-500 file:to-purple-500
                          file:text-white file:font-semibold
                          hover:file:from-cyan-600 hover:file:to-purple-600
                          file:cursor-pointer cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
                
                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-spin" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Analyser le dataset
                    </>
                  )}
                </Button>
              </div>
              
              {selectedFile && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20"
                >
                  <div className="flex items-center gap-2 text-sm text-cyan-300">
                    <FileText className="w-4 h-4" />
                    <span>
                      <span className="font-semibold">{selectedFile.name}</span>
                      <span className="text-gray-400 ml-2">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </span>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Datasets Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-black/20 backdrop-blur-sm border border-white/20 rounded-lg p-6 h-48"></div>
                </div>
              ))}
            </div>
          ) : datasets && Array.isArray(datasets) && datasets.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {datasets.map((dataset: Dataset, index: number) => (
                <motion.div
                  key={dataset.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="group"
                >
                  <Card className="bg-black/20 backdrop-blur-sm border-white/20 hover:border-cyan-400/40 transition-all duration-300 cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-white text-lg truncate flex-1 mr-2">
                          {dataset.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                            {dataset.column_count} cols
                          </Badge>
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                            {dataset.row_count} rows
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Calendar className="w-4 h-4" />
                        {new Date(dataset.created_at).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <BarChart3 className="w-4 h-4" />
                        {dataset.filename} • {(dataset.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Link href={`/dashboard?dataset=${dataset.id}`} className="flex-1">
                          <Button
                            size="sm"
                            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Visualiser
                          </Button>
                        </Link>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteDataset(dataset);
                          }}
                          disabled={deleteMutation.isPending}
                          className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <Database className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl text-gray-400 mb-2">Aucun dataset</h3>
              <p className="text-gray-500 mb-6">Uploadez votre premier dataset pour commencer l'analyse</p>
              <Button 
                onClick={() => (document.querySelector('input[type="file"]') as HTMLElement)?.click()}
                className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un dataset
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}