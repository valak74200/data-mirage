/**
 * usePerformance Hook - Monitoring et optimisation adaptive de performance
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { PerformanceMetrics, PerformanceMode, Canvas3DConfig } from '../types';
import { PerformanceMonitor, AdaptiveQualityManager, DeviceCapabilityDetector } from '../utils/performance';

interface UsePerformanceOptions {
  config: Canvas3DConfig;
  onPerformanceChange?: (metrics: PerformanceMetrics) => void;
  onQualityChange?: (mode: PerformanceMode) => void;
  enableAdaptiveQuality?: boolean;
}

interface UsePerformanceReturn {
  metrics: PerformanceMetrics;
  performanceMode: PerformanceMode;
  isOptimizing: boolean;
  performanceScore: number;
  recommendations: string[];
  startFrame: () => number;
  endFrame: (startTime: number, pointsRendered: number, totalPoints: number) => void;
  updateMetrics: (updateTime: number, lodReductions: number) => void;
  getOptimalSettings: () => Partial<Canvas3DConfig>;
  forceQualityMode: (mode: PerformanceMode) => void;
  resetPerformance: () => void;
  enableProfiling: (enabled: boolean) => void;
}

export function usePerformance({
  config,
  onPerformanceChange,
  onQualityChange,
  enableAdaptiveQuality = true
}: UsePerformanceOptions): UsePerformanceReturn {
  
  const monitorRef = useRef<PerformanceMonitor | null>(null);
  const qualityManagerRef = useRef<AdaptiveQualityManager | null>(null);
  const adaptiveIntervalRef = useRef<number | null>(null);
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    updateTime: 0,
    totalPoints: 0,
    visiblePoints: 0,
    lodReductions: 0,
    frameDrops: 0
  });

  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>(config.performance);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [performanceScore, setPerformanceScore] = useState(100);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // Initialize performance monitoring
  useEffect(() => {
    const monitor = new PerformanceMonitor({
      targetFPS: 60,
      maxFrameTime: 16.67,
      adaptiveQuality: enableAdaptiveQuality,
      memoryThreshold: 100 * 1024 * 1024,
      profileEnabled: config.performance === 'high'
    });

    const qualityManager = new AdaptiveQualityManager(monitor);

    monitorRef.current = monitor;
    qualityManagerRef.current = qualityManager;

    return () => {
      if (adaptiveIntervalRef.current) {
        clearInterval(adaptiveIntervalRef.current);
      }
    };
  }, [config.performance, enableAdaptiveQuality]);

  // Start adaptive quality management
  useEffect(() => {
    if (!enableAdaptiveQuality || !qualityManagerRef.current) return;

    const checkAdaptiveQuality = () => {
      if (!qualityManagerRef.current || !monitorRef.current) return;

      const adapted = qualityManagerRef.current.update();
      
      if (adapted) {
        setIsOptimizing(true);
        
        // Get recommended mode
        const recommendedMode = monitorRef.current.getRecommendedPerformanceMode();
        if (recommendedMode !== performanceMode) {
          setPerformanceMode(recommendedMode);
          
          if (onQualityChange) {
            onQualityChange(recommendedMode);
          }
        }

        // Clear optimizing flag after a delay
        setTimeout(() => setIsOptimizing(false), 2000);
      }
    };

    adaptiveIntervalRef.current = window.setInterval(checkAdaptiveQuality, 1000);

    return () => {
      if (adaptiveIntervalRef.current) {
        clearInterval(adaptiveIntervalRef.current);
      }
    };
  }, [enableAdaptiveQuality, performanceMode, onQualityChange]);

  // Update metrics periodically
  useEffect(() => {
    const updateMetricsInterval = setInterval(() => {
      if (!monitorRef.current) return;

      const newMetrics = monitorRef.current.getMetrics();
      setMetrics(newMetrics);

      const score = monitorRef.current.getPerformanceScore();
      setPerformanceScore(score);

      // Generate recommendations
      const newRecommendations = generateRecommendations(newMetrics, score);
      setRecommendations(newRecommendations);

      if (onPerformanceChange) {
        onPerformanceChange(newMetrics);
      }
    }, 2000);

    return () => clearInterval(updateMetricsInterval);
  }, [onPerformanceChange]);

  const startFrame = useCallback((): number => {
    return monitorRef.current?.startFrame() || performance.now();
  }, []);

  const endFrame = useCallback((startTime: number, pointsRendered: number, totalPoints: number) => {
    if (monitorRef.current) {
      monitorRef.current.endFrame(startTime, pointsRendered, totalPoints);
    }
  }, []);

  const updateMetrics = useCallback((updateTime: number, lodReductions: number) => {
    if (monitorRef.current) {
      monitorRef.current.updateMetrics(updateTime, lodReductions);
    }
  }, []);

  const getOptimalSettings = useCallback((): Partial<Canvas3DConfig> => {
    if (!monitorRef.current || !qualityManagerRef.current) {
      return DeviceCapabilityDetector.getRecommendedSettings();
    }

    const score = monitorRef.current.getPerformanceScore();
    const lodScale = qualityManagerRef.current.getLODScale();
    const maxPoints = qualityManagerRef.current.getMaxPoints();

    const settings: Partial<Canvas3DConfig> = {
      maxPoints,
      lodThreshold: Math.floor(1000 / lodScale),
      frustumCulling: true
    };

    // Adjust based on performance score
    if (score < 30) {
      settings.renderer = 'canvas2d';
      settings.performance = 'mobile';
      settings.antialiasing = false;
      settings.features = ['clustering', 'anomalies', 'selection'];
    } else if (score < 70) {
      settings.performance = 'balanced';
      settings.antialiasing = true;
      settings.features = ['clustering', 'anomalies', 'selection', 'connections', 'stats'];
    } else {
      settings.performance = 'high';
      settings.antialiasing = true;
      settings.features = ['clustering', 'anomalies', 'selection', 'animation', 'connections', 'minimap', 'legend', 'stats'];
    }

    return settings;
  }, []);

  const forceQualityMode = useCallback((mode: PerformanceMode) => {
    setPerformanceMode(mode);
    setIsOptimizing(false);
    
    if (qualityManagerRef.current) {
      qualityManagerRef.current.reset();
    }

    if (onQualityChange) {
      onQualityChange(mode);
    }
  }, [onQualityChange]);

  const resetPerformance = useCallback(() => {
    if (monitorRef.current) {
      monitorRef.current.reset();
    }
    
    if (qualityManagerRef.current) {
      qualityManagerRef.current.reset();
    }

    setMetrics({
      renderTime: 0,
      updateTime: 0,
      totalPoints: 0,
      visiblePoints: 0,
      lodReductions: 0,
      frameDrops: 0
    });

    setPerformanceScore(100);
    setRecommendations([]);
    setIsOptimizing(false);
  }, []);

  const enableProfiling = useCallback((enabled: boolean) => {
    // This would enable detailed profiling in the performance monitor
    console.log(`Performance profiling ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  // Generate performance recommendations
  const generateRecommendations = useCallback((
    metrics: PerformanceMetrics, 
    score: number
  ): string[] => {
    const recommendations: string[] = [];

    if (score < 40) {
      recommendations.push('Performance critique détectée');
    }

    if (metrics.frameDrops > 10) {
      recommendations.push('Trop de frames perdues - réduire la qualité');
    }

    if (metrics.renderTime > 25) {
      recommendations.push('Temps de rendu élevé - activer LOD');
    }

    if (metrics.visiblePoints > 50000) {
      recommendations.push('Trop de points visibles - améliorer le culling');
    }

    if (metrics.lodReductions < metrics.totalPoints * 0.1 && metrics.totalPoints > 10000) {
      recommendations.push('LOD sous-utilisé - ajuster les seuils');
    }

    const memoryUsage = monitorRef.current?.getMemoryUsage() || 0;
    if (memoryUsage > 100 * 1024 * 1024) {
      recommendations.push('Utilisation mémoire élevée - nettoyer les caches');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance optimale');
    }

    return recommendations;
  }, []);

  // Log performance stats in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && monitorRef.current) {
      const logInterval = setInterval(() => {
        monitorRef.current?.logStats();
      }, 10000); // Log every 10 seconds

      return () => clearInterval(logInterval);
    }
  }, []);

  return {
    metrics,
    performanceMode,
    isOptimizing,
    performanceScore,
    recommendations,
    startFrame,
    endFrame,
    updateMetrics,
    getOptimalSettings,
    forceQualityMode,
    resetPerformance,
    enableProfiling
  };
}

// Hook for simple FPS monitoring
export function useFPSMonitor(): { fps: number; frameTime: number } {
  const [fps, setFPS] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    let animationFrame: number;

    const measureFPS = () => {
      const now = performance.now();
      const delta = now - lastUpdateRef.current;
      
      frameTimesRef.current.push(delta);
      
      // Keep only last 60 frames
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Update FPS every second
      if (frameTimesRef.current.length >= 60) {
        const avgFrameTime = frameTimesRef.current.reduce((sum, time) => sum + time, 0) / frameTimesRef.current.length;
        setFrameTime(avgFrameTime);
        setFPS(Math.round(1000 / avgFrameTime));
      }

      lastUpdateRef.current = now;
      animationFrame = requestAnimationFrame(measureFPS);
    };

    animationFrame = requestAnimationFrame(measureFPS);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return { fps, frameTime };
}