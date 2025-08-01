import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Plus, Database, Calendar, Eye, Trash2, Upload, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";

export default function Datasets() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const { data: datasets, isLoading, refetch } = useQuery({
    queryKey: ["/api/datasets"],
    enabled: isAuthenticated,
  });

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const fileContent = await file.text();
      
      const response = await fetch("/api/datasets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileContent,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await refetch();
      setSelectedFile(null);
      
      toast({
        title: "Dataset uploadé",
        description: `${file.name} a été analysé avec succès`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: "Impossible d'uploader le dataset",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

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
            onClick={() => window.location.href = '/'}
            variant="ghost"
            className="text-gray-300 hover:text-white"
          >
            Visualisation 3D
          </Button>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <User className="w-4 h-4" />
            <span>{user ? ((user as any).firstName || (user as any).email) : 'Utilisateur'}</span>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/logout'}
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
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex-1">
                  <label className="block">
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
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
                
                <Button
                  onClick={() => selectedFile && handleFileUpload(selectedFile)}
                  disabled={!selectedFile || uploading}
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:opacity-50"
                >
                  {uploading ? "Upload..." : "Analyser"}
                </Button>
              </div>
              
              {selectedFile && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20"
                >
                  <p className="text-sm text-cyan-300">
                    Fichier sélectionné: <span className="font-semibold">{selectedFile.name}</span>
                  </p>
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
              {datasets.map((dataset: any, index: number) => (
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
                        <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                          {dataset.metadata?.columnCount || 0} cols
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Calendar className="w-4 h-4" />
                        {new Date(dataset.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                      
                      <div className="text-gray-400 text-sm">
                        {dataset.metadata?.rowCount || 0} lignes de données
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => window.location.href = `/?dataset=${dataset.id}`}
                          className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Visualiser
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
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