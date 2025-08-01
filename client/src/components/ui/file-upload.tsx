import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useVisualizationStore } from "@/stores/visualization-store";

interface FileUploadProps {
  onFileUploaded?: (datasetId: string) => void;
}

export default function FileUpload({ onFileUploaded }: FileUploadProps) {
  const { toast } = useToast();
  const { uploadDataset, isUploading } = useVisualizationStore();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or JSON file",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataset = await uploadDataset(file);
      toast({
        title: "✅ DATASET LOADED",
        description: `${dataset.name} est prêt pour la visualisation`,
      });
      onFileUploaded?.(dataset.id);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "❌ UPLOAD FAILED",
        description: "Impossible de charger le fichier. Vérifiez le format CSV/JSON.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <motion.div
      className={`glass-panel neon-border rounded-lg p-4 transition-all duration-300 cursor-pointer ${
        isDragActive ? 'border-green-400 shadow-lg shadow-green-400/20' : 'hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/20'
      } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => setIsDragActive(true)}
      onDragLeave={() => setIsDragActive(false)}
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={isUploading}
      />
      <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-cyan-400 transition-colors duration-300">
        <div className="text-cyan-400 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-sm text-gray-300">
          {isUploading ? 'Processing...' : isDragActive ? 'Drop file here' : 'Drop CSV/JSON files here'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {!isUploading && 'or click to browse'}
        </p>
      </div>
    </motion.div>
  );
}
