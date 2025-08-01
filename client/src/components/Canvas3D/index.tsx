/**
 * Canvas3D - Composant 3D unifié moderne
 * Remplace tous les composants 3D existants avec une architecture modulaire
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas3DProps, Canvas3DConfig, InteractionConfig, UIConfig, PerformanceMode } from './types';
import { useRenderer } from './hooks/useRenderer';
import { useCamera } from './hooks/useCamera';
import { useSelection } from './hooks/useSelection';
import { usePerformance } from './hooks/usePerformance';
import { InfoPanel, CompactInfoPanel } from './ui/InfoPanel';
import { Legend, CompactLegend } from './ui/Legend';
import { DeviceCapabilityDetector } from './utils/performance';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RotateCcw, 
  Play, 
  Pause, 
  Settings, 
  Monitor,
  Smartphone,
  Zap,
  AlertTriangle,
  Eye
} from 'lucide-react';

// Configuration par défaut
const DEFAULT_CONFIG: Canvas3DConfig = {
  renderer: 'canvas2d',
  performance: 'balanced',
  features: ['clustering', 'anomalies', 'selection', 'animation', 'connections', 'stats'],
  maxPoints: 50000,
  lodThreshold: 1000,
  frustumCulling: true,
  antialiasing: true
};

const DEFAULT_INTERACTIONS: InteractionConfig = {
  rotation: true,
  zoom: true,
  pan: true,
  selection: true,
  autoRotate: true,
  touchGestures: true,
  keyboardShortcuts: true
};

const DEFAULT_UI: UIConfig = {
  showLegend: true,
  showMinimap: false,
  showStats: true,
  showControls: true,
  showGrid: false,
  theme: 'dark'
};

interface StatsOverlayProps {
  stats: any;
  performanceMode: PerformanceMode;
  performanceScore: number;
  isOptimizing: boolean;
  compact?: boolean;
}

function StatsOverlay({ 
  stats, 
  performanceMode, 
  performanceScore, 
  isOptimizing, 
  compact = false 
}: StatsOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPerformanceModeIcon = (mode: PerformanceMode) => {
    switch (mode) {
      case 'high': return <Monitor className="w-3 h-3" />;
      case 'mobile': return <Smartphone className="w-3 h-3" />;
      default: return <Zap className="w-3 h-3" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 right-4 z-10"
    >
      <Card className="bg-black/90 border-cyan-500/30 backdrop-blur-md text-white shadow-xl">
        <div className="p-3">
          {compact && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-6 mb-2"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center space-x-2">
                <Eye className="w-3 h-3 text-cyan-400" />
                <span className="text-xs">Stats</span>
              </div>
              <Badge 
                variant="secondary" 
                className={`text-xs px-1 py-0 ${getPerformanceColor(performanceScore)}`}
              >
                {performanceScore.toFixed(0)}
              </Badge>
            </Button>
          )}

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2"
              >
                {/* Performance indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getPerformanceModeIcon(performanceMode)}
                    <span className="text-xs font-medium text-cyan-400">
                      Performance
                    </span>
                    {isOptimizing && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Settings className="w-3 h-3 text-yellow-400" />
                      </motion.div>
                    )}
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs px-2 py-0 ${getPerformanceColor(performanceScore)}`}
                  >
                    {performanceScore.toFixed(0)}/100
                  </Badge>
                </div>

                {/* Detailed stats */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">FPS:</span>
                    <span className={stats.fps < 30 ? 'text-red-400' : 'text-white'}>
                      {stats.fps || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Frame:</span>
                    <span className="text-white">{(stats.frameTime || 0).toFixed(1)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Points:</span>
                    <span className="text-white">
                      {stats.pointsRendered || 0}/{stats.totalPoints || 0}
                    </span>
                  </div>
                  {stats.pointsCulled > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Culled:</span>
                      <span className="text-green-400">{stats.pointsCulled}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mode:</span>
                    <Badge variant="outline" className="text-xs h-4 px-1">
                      {performanceMode}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}

export default function Canvas3D({
  data,
  config = {},
  interactions = {},
  ui = {},
  onPointSelect,
  onClusterSelect,
  onCameraChange,
  className = '',
  style
}: Canvas3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect device capabilities and merge configs
  const deviceSettings = DeviceCapabilityDetector.getRecommendedSettings();
  const isMobile = DeviceCapabilityDetector.isMobile();
  
  const finalConfig: Canvas3DConfig = {
    ...DEFAULT_CONFIG,
    ...deviceSettings,
    ...config
  };

  const finalInteractions: InteractionConfig = {
    ...DEFAULT_INTERACTIONS,
    ...interactions
  };

  const finalUI: UIConfig = {
    ...DEFAULT_UI,
    ...ui
  };

  // Initialize hooks
  const {
    renderer,
    isInitialized: rendererInitialized,
    error: rendererError,
    stats,
    initRenderer,
    render,
    resize
  } = useRenderer({
    config: finalConfig,
    onStatsUpdate: (newStats) => {
      // Handle stats updates
    }
  });

  const {
    camera,
    animationState,
    updateCamera,
    resetCamera,
    setAutoRotate,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleKeyDown
  } = useCamera({
    initialCamera: {
      position: [0, 0, 200],
      rotation: { x: 0.3, y: 0.3, z: 0 },
      zoom: 1
    },
    interactions: finalInteractions,
    onCameraChange
  });

  const {
    selectedPoint,
    hoveredPoint,
    selectedCluster,
    handleCanvasClick,
    handleCanvasMouseMove,
    clearSelection
  } = useSelection({
    onPointSelect,
    onClusterSelect,
    selectionRadius: isMobile ? 15 : 10
  });

  const {
    metrics,
    performanceMode,
    isOptimizing,
    performanceScore,
    recommendations,
    startFrame,
    endFrame
  } = usePerformance({
    config: finalConfig,
    enableAdaptiveQuality: finalConfig.performance !== 'high'
  });

  // Initialize renderer when canvas is ready
  useEffect(() => {
    if (canvasRef.current && !isInitialized) {
      initRenderer(canvasRef.current)
        .then(() => {
          setIsInitialized(true);
          setError(null);
        })
        .catch((err) => {
          setError(err.message);
          console.error('Canvas3D initialization failed:', err);
        });
    }
  }, [initRenderer, isInitialized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        resize({
          width: rect.width,
          height: rect.height,
          devicePixelRatio: window.devicePixelRatio || 1
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resize]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Ensure all resources are cleaned up when component unmounts
      if (canvasRef.current) {
        // Clear canvas content
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    };
  }, []);

  // Render loop
  useEffect(() => {
    if (!renderer || !rendererInitialized || !data?.points || data.points.length === 0) return;

    let animationFrame: number;

    const renderLoop = () => {
      // Double-check data is still available before rendering
      if (!data?.points || data.points.length === 0) {
        return;
      }

      const frameStart = startFrame();
      
      try {
        render(data.points, camera);
        endFrame(frameStart, data.points.length, data.points.length);
      } catch (err) {
        console.error('Render error:', err);
        // Stop the render loop on error to prevent spam
        return;
      }

      animationFrame = requestAnimationFrame(renderLoop);
    };

    animationFrame = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [renderer, rendererInitialized, data?.points?.length, camera, render, startFrame, endFrame]);

  // Handle canvas interactions
  const handleCanvasInteraction = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !data?.points || data.points.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const viewport = {
      width: rect.width,
      height: rect.height,
      devicePixelRatio: window.devicePixelRatio || 1
    };

    // Handle selection
    if (finalInteractions.selection) {
      handleCanvasClick(e, data.points, data.clusters || [], camera, viewport);
    }

    // Handle rotation
    handleMouseDown(e);
  }, [data?.points, data?.clusters, camera, finalInteractions.selection, handleCanvasClick, handleMouseDown]);

  // Error state
  if (error || rendererError) {
    return (
      <div className={`flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 to-red-900 ${className}`}>
        <Card className="bg-red-900/50 border-red-500/50 p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-400 mb-2">Erreur de rendu 3D</h3>
          <p className="text-red-300 mb-4">{error || rendererError}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="border-red-500 text-red-400 hover:bg-red-500/20"
          >
            Recharger la page
          </Button>
        </Card>
      </div>
    );
  }

  // Loading/Empty state
  if (!data || !data.points || data.points.length === 0) {
    return (
      <div className={`flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 ${className}`} style={style}>
        <div className="text-center">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 180, 360] 
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="text-6xl mb-6 text-cyan-400"
          >
            ✨
          </motion.div>
          <h3 className="text-2xl font-semibold mb-4 text-white">
            {!data ? 'Initialisation...' : 'Univers 3D en attente'}
          </h3>
          <p className="text-gray-300 leading-relaxed max-w-md">
            {!data 
              ? 'Préparation de l\'environnement 3D...' 
              : 'Uploadez et analysez un dataset pour découvrir votre univers de données en 3D'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex-1 overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 ${className}`} style={style}>
      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleCanvasInteraction}
        onMouseMove={(e) => {
          handleMouseMove(e);
          if (finalInteractions.selection && canvasRef.current && data?.points && data.points.length > 0) {
            const rect = canvasRef.current.getBoundingClientRect();
            const viewport = {
              width: rect.width,
              height: rect.height,
              devicePixelRatio: window.devicePixelRatio || 1
            };
            handleCanvasMouseMove(e, data.points, camera, viewport);
          }
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ touchAction: 'none' }}
      />

      {/* UI Overlays */}
      <AnimatePresence>
        {/* Legend */}
        {finalUI.showLegend && data?.clusters && data.clusters.length > 0 && data.points && (
          isMobile ? (
            <CompactLegend
              clusters={data.clusters}
              points={data.points}
              onClusterSelect={onClusterSelect}
            />
          ) : (
            <Legend
              clusters={data.clusters}
              points={data.points}
              onClusterSelect={onClusterSelect}
              compact={isMobile}
            />
          )
        )}

        {/* Stats */}
        {finalUI.showStats && (
          <StatsOverlay
            stats={stats}
            performanceMode={performanceMode}
            performanceScore={performanceScore}
            isOptimizing={isOptimizing}
            compact={isMobile}
          />
        )}

        {/* Info Panel */}
        {finalInteractions.selection && (selectedPoint || selectedCluster) && (
          isMobile ? (
            <CompactInfoPanel
              selectedPoint={selectedPoint}
              selectedCluster={selectedCluster}
              onClose={clearSelection}
            />
          ) : (
            <InfoPanel
              selectedPoint={selectedPoint}
              selectedCluster={selectedCluster}
              onClose={clearSelection}
            />
          )
        )}

        {/* Controls */}
        {finalUI.showControls && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 z-10"
          >
            <Card className="bg-black/90 border-cyan-500/30 backdrop-blur-md text-white p-3">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetCamera}
                  className="h-8 px-2 text-gray-400 hover:text-white"
                  title="Reset caméra"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoRotate(!animationState.autoRotate)}
                  className={`h-8 px-2 ${
                    animationState.autoRotate 
                      ? 'text-cyan-400 bg-cyan-400/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title={`${animationState.autoRotate ? 'Arrêter' : 'Démarrer'} rotation automatique`}
                >
                  {animationState.autoRotate ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>

                {!isMobile && (
                  <div className="text-xs text-gray-400 ml-2 space-y-0.5">
                    <div>🖱️ Glisser: Rotation</div>
                    <div>🔄 Molette: Zoom</div>
                    <div>👆 Clic: Sélection</div>
                  </div>
                )}
              </div>

              {isMobile && (
                <div className="text-xs text-gray-400 mt-2 space-y-0.5">
                  <div>👆 Glisser: Rotation</div>
                  <div>🤏 Pincer: Zoom</div>
                  <div>👆 Appui: Sélection</div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Performance warnings */}
        {performanceScore < 40 && recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
          >
            <Card className="bg-yellow-900/90 border-yellow-500/50 backdrop-blur-md text-yellow-100 p-4 max-w-sm">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <h4 className="font-medium">Performance dégradée</h4>
              </div>
              <p className="text-sm mb-3">
                {recommendations[0]}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/20"
                onClick={() => {
                  // Force mobile mode for better performance
                  window.location.reload();
                }}
              >
                Optimiser automatiquement
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}