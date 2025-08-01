import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Lightbulb, TrendingUp, Info } from "lucide-react";
import { useState } from "react";
import { ClusterAnalysis } from "@shared/types";

interface ClusterExplanationsProps {
  explanations: ClusterAnalysis[];
  selectedCluster?: number;
  onSelectCluster?: (clusterId: number) => void;
}

export function ClusterExplanations({ 
  explanations, 
  selectedCluster, 
  onSelectCluster 
}: ClusterExplanationsProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());

  const toggleExpanded = (clusterId: number) => {
    const newExpanded = new Set(expandedClusters);
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId);
    } else {
      newExpanded.add(clusterId);
    }
    setExpandedClusters(newExpanded);
  };

  const getClusterColor = (clusterId: number) => {
    const colors = [
      'from-blue-500 to-cyan-500',
      'from-purple-500 to-pink-500', 
      'from-green-500 to-emerald-500',
      'from-orange-500 to-red-500',
      'from-indigo-500 to-purple-500',
      'from-cyan-500 to-blue-500'
    ];
    return colors[clusterId % colors.length];
  };

  if (!explanations || explanations.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4"
      >
        <div className="flex items-center gap-2 text-white/60">
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm">Analyse des clusters en cours...</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-white mb-4">
        <Lightbulb className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold">Explications IA</h3>
      </div>

      <AnimatePresence>
        {explanations.map((explanation) => (
          <motion.div
            key={explanation.clusterId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-black/30 backdrop-blur-md border rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
              selectedCluster === explanation.clusterId
                ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                : 'border-white/10 hover:border-white/20'
            }`}
            onClick={() => onSelectCluster?.(explanation.clusterId)}
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${getClusterColor(explanation.clusterId)}`} />
                <div>
                  <h4 className="text-white font-medium">
                    Cluster {explanation.clusterId}
                  </h4>
                  <p className="text-white/60 text-sm">
                    {explanation.dataPoints} points de données
                  </p>
                </div>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(explanation.clusterId);
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                {expandedClusters.has(explanation.clusterId) ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Content */}
            <AnimatePresence>
              {expandedClusters.has(explanation.clusterId) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    {/* Explanation */}
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <span className="text-cyan-400 text-sm font-medium">Explication</span>
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed">
                        {explanation.explanation}
                      </p>
                    </div>

                    {/* Characteristics */}
                    {explanation.characteristics.length > 0 && (
                      <div className="bg-black/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 text-sm font-medium">Caractéristiques</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {explanation.characteristics.map((char, index) => (
                            <span
                              key={index}
                              className="bg-green-500/20 text-green-300 px-2 py-1 rounded text-xs"
                            >
                              {char}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Features */}
                    {explanation.keyFeatures.length > 0 && (
                      <div className="bg-black/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-purple-400" />
                          <span className="text-purple-400 text-sm font-medium">Points clés</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {explanation.keyFeatures.map((feature, index) => (
                            <span
                              key={index}
                              className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}