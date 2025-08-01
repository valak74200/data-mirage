/**
 * InfoPanel - Panneau d'information pour point sélectionné
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Point3D, Cluster } from '../types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, MapPin, Layers, AlertTriangle, Info } from 'lucide-react';

interface InfoPanelProps {
  selectedPoint: Point3D | null;
  selectedCluster: Cluster | null;
  onClose: () => void;
  className?: string;
}

export function InfoPanel({ 
  selectedPoint, 
  selectedCluster, 
  onClose, 
  className = '' 
}: InfoPanelProps) {
  
  if (!selectedPoint && !selectedCluster) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`absolute bottom-4 right-4 z-10 ${className}`}
      >
        <Card className="w-80 max-w-sm bg-black/90 border-cyan-500/30 backdrop-blur-md text-white shadow-xl">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {selectedPoint ? (
                  <>
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-semibold text-cyan-400">Point sélectionné</h3>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-green-400" />
                    <h3 className="font-semibold text-green-400">Cluster sélectionné</h3>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Point Information */}
            {selectedPoint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">ID:</span>
                    <div className="font-mono text-white break-all">
                      {selectedPoint.id}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Taille:</span>
                    <div className="text-white">
                      {(selectedPoint.size || 4).toFixed(1)}px
                    </div>
                  </div>
                </div>

                {/* Position */}
                <div>
                  <span className="text-gray-400 text-sm">Position 3D:</span>
                  <div className="font-mono text-blue-400 text-xs bg-blue-400/10 rounded px-2 py-1 mt-1">
                    [{selectedPoint.position[0].toFixed(2)}, {selectedPoint.position[1].toFixed(2)}, {selectedPoint.position[2].toFixed(2)}]
                  </div>
                </div>

                {/* Cluster Badge */}
                {selectedPoint.cluster && (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">Cluster:</span>
                    <Badge 
                      variant="secondary"
                      className="bg-green-500/20 text-green-400 border-green-500/30"
                    >
                      <div 
                        className="w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: selectedPoint.color }}
                      />
                      {selectedPoint.cluster}
                    </Badge>
                  </div>
                )}

                {/* Anomaly Alert */}
                {selectedPoint.isAnomaly && (
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-sm font-medium">
                      Anomalie détectée
                    </span>
                  </motion.div>
                )}

                {/* Original Data */}
                {selectedPoint.originalData && (
                  <div className="border-t border-gray-700 pt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Info className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                        Données originales
                      </span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                      {Object.entries(selectedPoint.originalData)
                        .slice(0, 8)
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between items-start">
                            <span className="text-gray-400 truncate mr-2 min-w-0 flex-1">
                              {key}:
                            </span>
                            <span className="text-white text-right break-all max-w-32">
                              {typeof value === 'number' 
                                ? value.toFixed(3)
                                : String(value).substring(0, 20)}
                            </span>
                          </div>
                        ))}
                      {Object.keys(selectedPoint.originalData).length > 8 && (
                        <div className="text-gray-500 text-center italic">
                          ... et {Object.keys(selectedPoint.originalData).length - 8} autres propriétés
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Cluster Information */}
            {selectedCluster && !selectedPoint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {/* Basic Cluster Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">ID:</span>
                    <div className="text-white font-mono">
                      {selectedCluster.id}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Points:</span>
                    <div className="text-white font-semibold">
                      {selectedCluster.points.length}
                    </div>
                  </div>
                </div>

                {/* Cluster Center */}
                <div>
                  <span className="text-gray-400 text-sm">Centre du cluster:</span>
                  <div className="font-mono text-green-400 text-xs bg-green-400/10 rounded px-2 py-1 mt-1">
                    [{selectedCluster.center[0].toFixed(2)}, {selectedCluster.center[1].toFixed(2)}, {selectedCluster.center[2].toFixed(2)}]
                  </div>
                </div>

                {/* Color Preview */}
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 text-sm">Couleur:</span>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full border border-gray-600"
                      style={{ backgroundColor: selectedCluster.color }}
                    />
                    <span className="text-xs font-mono text-gray-300">
                      {selectedCluster.color}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

// Variante compacte pour mobile
export function CompactInfoPanel({ 
  selectedPoint, 
  selectedCluster, 
  onClose, 
  className = '' 
}: InfoPanelProps) {
  
  if (!selectedPoint && !selectedCluster) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`absolute bottom-0 left-0 right-0 z-10 ${className}`}
      >
        <Card className="rounded-t-lg rounded-b-none bg-black/95 border-t border-cyan-500/30 backdrop-blur-md text-white shadow-2xl">
          <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {selectedPoint ? (
                  <MapPin className="w-3 h-3 text-cyan-400" />
                ) : (
                  <Layers className="w-3 h-3 text-green-400" />
                )}
                <h4 className="text-sm font-medium text-cyan-400">
                  {selectedPoint ? 'Point' : 'Cluster'} {selectedPoint?.id || selectedCluster?.id}
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-5 w-5 p-0 text-gray-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            {/* Compact Info */}
            {selectedPoint && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  {selectedPoint.cluster && (
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      Cluster {selectedPoint.cluster}
                    </Badge>
                  )}
                  {selectedPoint.isAnomaly && (
                    <Badge variant="destructive" className="text-xs px-1 py-0">
                      <AlertTriangle className="w-2 h-2 mr-1" />
                      Anomalie
                    </Badge>
                  )}
                </div>
                <div className="text-blue-400 font-mono">
                  [{selectedPoint.position.map(p => p.toFixed(1)).join(', ')}]
                </div>
              </div>
            )}

            {selectedCluster && !selectedPoint && (
              <div className="flex items-center justify-between text-xs">
                <div className="text-gray-400">
                  {selectedCluster.points.length} points
                </div>
                <div className="text-green-400 font-mono">
                  [{selectedCluster.center.map(p => p.toFixed(1)).join(', ')}]
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}