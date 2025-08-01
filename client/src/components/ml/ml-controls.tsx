import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Play, Settings, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

interface MLControlsProps {
  dataset: any;
  onProcessingComplete: (result: any) => void;
}

export default function MLControls({ dataset, onProcessingComplete }: MLControlsProps) {
  const [processing, setProcessing] = useState(false);
  const [config, setConfig] = useState({
    algorithm: "tsne",
    clusters: 3,
    iterations: 1000,
    perplexity: 30,
  });
  const { toast } = useToast();

  const handleProcess = async () => {
    if (!dataset) return;
    
    setProcessing(true);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datasetId: dataset.id,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      onProcessingComplete(result);
      
      toast({
        title: "Analyse terminée",
        description: "Visualisation 3D générée avec succès",
      });
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Erreur de traitement",
        description: "Impossible de traiter le dataset",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-400" />
            Algorithme de réduction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-400 mb-2 block">TYPE D'ALGORITHME</Label>
            <Select value={config.algorithm} onValueChange={(value) => setConfig({...config, algorithm: value})}>
              <SelectTrigger className="bg-black/20 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="tsne">t-SNE (recommandé)</SelectItem>
                <SelectItem value="umap">UMAP</SelectItem>
                <SelectItem value="pca">PCA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-400 mb-2 block">
              NOMBRE DE CLUSTERS: {config.clusters}
            </Label>
            <Slider
              value={[config.clusters]}
              onValueChange={(value) => setConfig({...config, clusters: value[0]})}
              max={10}
              min={2}
              step={1}
              className="w-full"
            />
          </div>

          {config.algorithm === "tsne" && (
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">
                PERPLEXITÉ: {config.perplexity}
              </Label>
              <Slider
                value={[config.perplexity]}
                onValueChange={(value) => setConfig({...config, perplexity: value[0]})}
                max={50}
                min={5}
                step={5}
                className="w-full"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="text-xs text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Dataset:</span>
                <span className="text-cyan-400">{dataset.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Lignes:</span>
                <span className="text-cyan-400">{dataset.metadata?.rowCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Colonnes:</span>
                <span className="text-cyan-400">{dataset.metadata?.columnCount || 0}</span>
              </div>
            </div>
            
            <Button
              onClick={handleProcess}
              disabled={processing}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
            >
              {processing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {processing ? "Traitement..." : "Générer la visualisation"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick tips */}
      <div className="text-xs text-gray-500 space-y-1 bg-black/20 p-3 rounded-lg">
        <p><strong className="text-cyan-400">t-SNE:</strong> Idéal pour révéler des clusters complexes</p>
        <p><strong className="text-purple-400">UMAP:</strong> Plus rapide, préserve la structure globale</p>
        <p><strong className="text-green-400">PCA:</strong> Simple et rapide pour des données linéaires</p>
      </div>
    </div>
  );
}