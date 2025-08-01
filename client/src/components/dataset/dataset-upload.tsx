import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, File, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface DatasetUploadProps {
  onDatasetCreated: (dataset: any) => void;
}

export default function DatasetUpload({ onDatasetCreated }: DatasetUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    try {
      const fileContent = await selectedFile.text();
      
      const response = await fetch("/api/datasets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileContent,
          mimeType: selectedFile.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const dataset = await response.json();
      onDatasetCreated(dataset);
      setSelectedFile(null);
      
      toast({
        title: "Dataset créé",
        description: `${selectedFile.name} a été analysé avec succès`,
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

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* File Input */}
          <div className="relative">
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-upload"
            />
            <label 
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-cyan-400/40 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-300 text-center">
                Cliquez pour sélectionner<br />
                <span className="text-xs text-gray-500">CSV ou JSON uniquement</span>
              </p>
            </label>
          </div>

          {/* Selected File */}
          {selectedFile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20"
            >
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-cyan-300 flex-1 truncate">
                  {selectedFile.name}
                </span>
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </motion.div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:opacity-50"
          >
            {uploading ? "Analyse en cours..." : "Analyser le dataset"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}