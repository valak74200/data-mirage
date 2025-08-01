/**
 * Legend - Légende des clusters et anomalies
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cluster, Point3D } from '../types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Palette, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Circle, 
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';

interface LegendProps {
  clusters: Cluster[];
  points: Point3D[];
  onClusterToggle?: (clusterId: string | number, visible: boolean) => void;
  onClusterSelect?: (cluster: Cluster) => void;
  className?: string;
  compact?: boolean;
}

interface LegendItemProps {
  cluster: Cluster;
  pointCount: number;
  anomalyCount: number;
  isVisible?: boolean;
  onToggle?: (visible: boolean) => void;
  onSelect?: () => void;
  compact?: boolean;
}

function LegendItem({ 
  cluster, 
  pointCount, 
  anomalyCount, 
  isVisible = true, 
  onToggle, 
  onSelect,
  compact = false 
}: LegendItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group ${
        !isVisible ? 'opacity-50' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {/* Color indicator */}
        <div className="relative">
          <div 
            className={`w-4 h-4 rounded-full border-2 border-white/20 transition-all group-hover:border-white/40 ${
              !isVisible ? 'opacity-50' : ''
            }`}
            style={{ backgroundColor: cluster.color }}
          />
          {anomalyCount > 0 && (
            <div className="absolute -top-1 -right-1">
              <AlertTriangle className="w-2 h-2 text-red-400" />
            </div>
          )}
        </div>

        {/* Cluster info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-white truncate">
              {cluster.id === 'unclustered' ? 'Non groupé' : `Cluster ${cluster.id}`}
            </span>
            {compact && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {pointCount}
              </Badge>
            )}
          </div>
          {!compact && (
            <div className="flex items-center space-x-2 text-xs text-gray-400 mt-0.5">
              <span>{pointCount} points</span>
              {anomalyCount > 0 && (
                <span className="text-red-400">
                  {anomalyCount} anomalie{anomalyCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-1">
        {!compact && pointCount > 0 && (
          <span className="text-xs text-gray-500 mr-2">
            {pointCount}
          </span>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(!isVisible);
            }}
          >
            {isVisible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function Legend({ 
  clusters, 
  points, 
  onClusterToggle, 
  onClusterSelect, 
  className = '',
  compact = false 
}: LegendProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [visibleClusters, setVisibleClusters] = React.useState<Set<string | number>>(
    new Set(clusters.map(c => c.id))
  );

  // Calculate statistics
  const clusterStats = React.useMemo(() => {
    return clusters.map(cluster => {
      const clusterPoints = points.filter(p => p.cluster === cluster.id);
      const anomalies = clusterPoints.filter(p => p.isAnomaly);
      
      return {
        cluster,
        pointCount: clusterPoints.length,
        anomalyCount: anomalies.length
      };
    }).sort((a, b) => b.pointCount - a.pointCount);
  }, [clusters, points]);

  const totalPoints = points.length;
  const totalAnomalies = points.filter(p => p.isAnomaly).length;
  const clusteredPoints = points.filter(p => p.cluster && p.cluster !== 'unclustered').length;

  const handleClusterToggle = (clusterId: string | number, visible: boolean) => {
    const newVisibleClusters = new Set(visibleClusters);
    if (visible) {
      newVisibleClusters.add(clusterId);
    } else {
      newVisibleClusters.delete(clusterId);
    }
    setVisibleClusters(newVisibleClusters);
    
    if (onClusterToggle) {
      onClusterToggle(clusterId, visible);
    }
  };

  const handleClusterSelect = (cluster: Cluster) => {
    if (onClusterSelect) {
      onClusterSelect(cluster);
    }
  };

  if (clusters.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`absolute top-4 left-4 z-10 ${className}`}
    >
      <Card className={`bg-black/90 border-cyan-500/30 backdrop-blur-md text-white shadow-xl ${
        compact ? 'w-64' : 'w-72'
      } ${isCollapsed ? 'pb-2' : ''}`}>
        {/* Header */}
        <div className="p-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-cyan-400">Légende</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Summary stats */}
          {!isCollapsed && (
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <Circle className="w-2 h-2 text-blue-400" />
                <span>{totalPoints} points</span>
              </div>
              <div className="flex items-center space-x-1">
                <Layers className="w-2 h-2 text-green-400" />
                <span>{clusters.length} clusters</span>
              </div>
              {totalAnomalies > 0 && (
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-2 h-2 text-red-400" />
                  <span>{totalAnomalies} anomalies</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cluster list */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ScrollArea className={compact ? "h-48" : "h-64"}>
                <div className="p-2 space-y-1">
                  {clusterStats.map(({ cluster, pointCount, anomalyCount }) => (
                    <LegendItem
                      key={cluster.id}
                      cluster={cluster}
                      pointCount={pointCount}
                      anomalyCount={anomalyCount}
                      isVisible={visibleClusters.has(cluster.id)}
                      onToggle={(visible) => handleClusterToggle(cluster.id, visible)}
                      onSelect={() => handleClusterSelect(cluster)}
                      compact={compact}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Footer controls */}
              <div className="p-2 border-t border-gray-700">
                <div className="flex justify-between text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-gray-400 hover:text-white"
                    onClick={() => {
                      const allVisible = new Set(clusters.map(c => c.id));
                      setVisibleClusters(allVisible);
                      clusters.forEach(c => onClusterToggle?.(c.id, true));
                    }}
                  >
                    Tout afficher
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-gray-400 hover:text-white"
                    onClick={() => {
                      setVisibleClusters(new Set());
                      clusters.forEach(c => onClusterToggle?.(c.id, false));
                    }}
                  >
                    Tout masquer
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// Légende compacte pour mobile
export function CompactLegend({ 
  clusters, 
  points, 
  onClusterSelect, 
  className = '' 
}: LegendProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Top 5 clusters par taille
  const topClusters = React.useMemo(() => {
    return clusters
      .map(cluster => ({
        cluster,
        pointCount: points.filter(p => p.cluster === cluster.id).length
      }))
      .sort((a, b) => b.pointCount - a.pointCount)
      .slice(0, 5);
  }, [clusters, points]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`absolute top-2 left-2 right-2 z-10 ${className}`}
    >
      <Card className="bg-black/95 border-cyan-500/30 backdrop-blur-md text-white shadow-xl">
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 text-sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center space-x-2">
              <Palette className="w-3 h-3 text-cyan-400" />
              <span>{clusters.length} clusters</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 mt-2">
                  {topClusters.map(({ cluster, pointCount }) => (
                    <div
                      key={cluster.id}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 cursor-pointer"
                      onClick={() => onClusterSelect?.(cluster)}
                    >
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cluster.color }}
                        />
                        <span className="text-xs">
                          {cluster.id === 'unclustered' ? 'Non groupé' : `Cluster ${cluster.id}`}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{pointCount}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}