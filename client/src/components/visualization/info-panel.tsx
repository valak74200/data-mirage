import { motion } from "framer-motion";
import GlassPanel from "@/components/ui/glass-panel";
import { DataPoint } from "@shared/schema";

interface InfoPanelProps {
  point: DataPoint;
  isMobile?: boolean;
}

export default function InfoPanel({ point, isMobile = false }: InfoPanelProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={`absolute ${isMobile ? 'bottom-20 left-4 right-4' : 'bottom-4 left-4'} z-20 ${isMobile ? '' : 'max-w-sm'}`}
    >
      <GlassPanel className="p-4">
        <div className="font-orbitron text-sm font-bold text-cyan-400 mb-2 neon-glow">
          DATA POINT DETAILS
        </div>
        <div className="space-y-1 text-xs">
          <div>Index: <span className="text-green-400">{point.originalIndex}</span></div>
          {point.cluster !== undefined && (
            <div>Cluster: <span className="text-cyan-400">Cluster {point.cluster + 1}</span></div>
          )}
          {point.isAnomaly && (
            <div className="text-red-400 font-bold animate-pulse">⚠ ANOMALY DETECTED</div>
          )}
          
          <div className="mt-3 pt-2 border-t border-gray-600">
            <div className="text-gray-400 mb-1">Original Data:</div>
            {Object.entries(point.originalData).slice(0, 5).map(([key, value]) => (
              <div key={key}>
                {key}: <span className="text-white">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
