import { motion } from "framer-motion";
import GlassPanel from "@/components/ui/glass-panel";

interface Cluster {
  id: number;
  color: string;
  count: number;
  label: string;
}

interface LegendPanelProps {
  clusters: Cluster[];
  isMobile?: boolean;
}

export default function LegendPanel({ clusters, isMobile = false }: LegendPanelProps) {
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`absolute ${isMobile ? 'top-16 left-4 right-4' : 'top-20 right-4'} z-20`}
    >
      <GlassPanel className="p-4">
        <div className="font-orbitron text-sm font-bold text-violet-400 mb-3 neon-glow">
          LEGEND
        </div>
        <div className="space-y-2 text-xs">
          {clusters.map((cluster) => (
            <motion.div
              key={cluster.id}
              className="flex items-center space-x-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: cluster.id * 0.1 }}
            >
              <div 
                className="w-3 h-3 rounded-full pulse-neon"
                style={{ backgroundColor: cluster.color }}
              />
              <span>{cluster.label} ({cluster.count} points)</span>
            </motion.div>
          ))}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
