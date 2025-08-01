/**
 * useRenderer Hook - Gestion centralisée du renderer 3D
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { BaseRenderer } from '../renderers/BaseRenderer';
import { Canvas2DRenderer } from '../renderers/Canvas2DRenderer';
import { 
  RendererContext, 
  Canvas3DConfig, 
  ViewportDimensions, 
  Camera,
  Point3D,
  RenderStats,
  RendererType
} from '../types';
import { DeviceCapabilityDetector } from '../utils/performance';

interface UseRendererOptions {
  config: Canvas3DConfig;
  onStatsUpdate?: (stats: RenderStats) => void;
  onRendererChange?: (type: RendererType) => void;
}

interface UseRendererReturn {
  renderer: BaseRenderer | null;
  isInitialized: boolean;
  error: string | null;
  stats: RenderStats;
  initRenderer: (canvas: HTMLCanvasElement) => Promise<void>;
  render: (points: Point3D[], camera: Camera) => void;
  resize: (viewport: ViewportDimensions) => void;
  dispose: () => void;
  switchRenderer: (type: RendererType) => Promise<void>;
}

export function useRenderer({
  config,
  onStatsUpdate,
  onRendererChange
}: UseRendererOptions): UseRendererReturn {
  const rendererRef = useRef<BaseRenderer | null>(null);
  const contextRef = useRef<RendererContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RenderStats>({
    fps: 0,
    frameTime: 0,
    pointsRendered: 0,
    pointsCulled: 0,
    drawCalls: 0,
    memoryUsage: 0
  });

  // Create renderer instance based on type and capabilities
  const createRenderer = useCallback((type: RendererType): BaseRenderer => {
    switch (type) {
      case 'webgl':
        // TODO: Implement WebGLRenderer
        console.warn('WebGLRenderer not yet implemented, falling back to Canvas2D');
        return new Canvas2DRenderer();
      case 'canvas2d':
        return new Canvas2DRenderer();
      default:
        return new Canvas2DRenderer();
    }
  }, []);

  // Auto-select best renderer based on device capabilities
  const getBestRenderer = useCallback((): RendererType => {
    if (config.renderer !== 'webgl') {
      return config.renderer;
    }

    // Auto-detect best renderer
    const deviceClass = DeviceCapabilityDetector.getDeviceClass();
    const isMobile = DeviceCapabilityDetector.isMobile();
    const supportsWebGL2 = DeviceCapabilityDetector.supportsWebGL2();

    if (isMobile || deviceClass === 'low-end' || !supportsWebGL2) {
      return 'canvas2d';
    }

    return 'webgl'; // Will fallback to canvas2d when WebGL renderer is not available
  }, [config.renderer]);

  const initRenderer = useCallback(async (canvas: HTMLCanvasElement) => {
    try {
      setError(null);
      setIsInitialized(false);

      // Dispose existing renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      // Get optimal renderer type
      const bestRendererType = getBestRenderer();
      
      // Create new renderer
      const newRenderer = createRenderer(bestRendererType);
      
      // Get initial viewport dimensions
      const rect = canvas.getBoundingClientRect();
      const viewport: ViewportDimensions = {
        width: rect.width,
        height: rect.height,
        devicePixelRatio: window.devicePixelRatio || 1
      };

      // Create context
      const context: RendererContext = {
        canvas,
        viewport,
        camera: {
          position: [0, 0, 200],
          rotation: { x: 0.3, y: 0.3, z: 0 },
          zoom: 1,
          target: [0, 0, 0],
          fov: 75
        },
        config
      };

      contextRef.current = context;

      // Initialize renderer
      await newRenderer.init(context);
      rendererRef.current = newRenderer;
      
      setIsInitialized(true);
      
      // Notify about renderer type
      if (onRendererChange) {
        onRendererChange(bestRendererType);
      }

      console.log(`Renderer initialized: ${bestRendererType}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize renderer';
      setError(errorMessage);
      console.error('Renderer initialization failed:', err);
    }
  }, [config, createRenderer, getBestRenderer, onRendererChange]);

  const render = useCallback((points: Point3D[], camera: Camera) => {
    if (!rendererRef.current || !isInitialized) return;

    try {
      // Update camera in context
      if (contextRef.current) {
        contextRef.current.camera = camera;
      }

      // Render frame
      rendererRef.current.render(points, camera);
      
      // Update stats
      const newStats = rendererRef.current.getStats();
      setStats(newStats);
      
      if (onStatsUpdate) {
        onStatsUpdate(newStats);
      }
    } catch (err) {
      console.error('Render error:', err);
      setError(err instanceof Error ? err.message : 'Render failed');
    }
  }, [isInitialized, onStatsUpdate]);

  const resize = useCallback((viewport: ViewportDimensions) => {
    if (!rendererRef.current || !contextRef.current) return;

    try {
      // Update context
      contextRef.current.viewport = viewport;
      
      // Resize renderer
      rendererRef.current.resize(viewport);
    } catch (err) {
      console.error('Resize error:', err);
    }
  }, []);

  const dispose = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    contextRef.current = null;
    setIsInitialized(false);
    setError(null);
  }, []);

  const switchRenderer = useCallback(async (type: RendererType) => {
    if (!contextRef.current) return;

    try {
      setError(null);
      
      // Create new renderer
      const newRenderer = createRenderer(type);
      
      // Dispose old renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      // Initialize new renderer with existing context
      await newRenderer.init(contextRef.current);
      rendererRef.current = newRenderer;
      
      if (onRendererChange) {
        onRendererChange(type);
      }

      console.log(`Switched to renderer: ${type}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch renderer';
      setError(errorMessage);
      console.error('Renderer switch failed:', err);
    }
  }, [createRenderer, onRendererChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
      // Also dispose the device capability detector to clean up any WebGL contexts
      DeviceCapabilityDetector.dispose();
    };
  }, [dispose]);

  // Auto-switch renderer based on performance
  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;

    const checkPerformance = () => {
      const currentStats = rendererRef.current!.getStats();
      
      // Auto-switch to canvas2d if WebGL performance is poor
      if (config.renderer === 'webgl' && currentStats.fps < 30 && currentStats.frameTime > 33) {
        console.log('Poor WebGL performance, switching to Canvas2D');
        switchRenderer('canvas2d');
      }
    };

    // Check performance every 5 seconds
    const performanceInterval = setInterval(checkPerformance, 5000);

    return () => {
      clearInterval(performanceInterval);
    };
  }, [isInitialized, config.renderer, switchRenderer]);

  return {
    renderer: rendererRef.current,
    isInitialized,
    error,
    stats,
    initRenderer,
    render,
    resize,
    dispose,
    switchRenderer
  };
}