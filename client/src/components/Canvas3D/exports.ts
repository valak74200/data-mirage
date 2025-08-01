/**
 * Canvas3D Exports - Point d'entrée unifié
 */

// Main component
export { default as Canvas3D } from './index';

// Types
export type {
  Point3D,
  Cluster,
  ProcessingResult,
  Camera,
  Canvas3DProps,
  Canvas3DConfig,
  InteractionConfig,
  UIConfig,
  RendererType,
  PerformanceMode,
  FeatureFlag,
  RenderStats,
  PerformanceMetrics
} from './types';

// Hooks
export { useRenderer } from './hooks/useRenderer';
export { useCamera } from './hooks/useCamera';
export { useSelection } from './hooks/useSelection';
export { usePerformance, useFPSMonitor } from './hooks/usePerformance';

// UI Components
export { InfoPanel, CompactInfoPanel } from './ui/InfoPanel';
export { Legend, CompactLegend } from './ui/Legend';

// Utilities
export { GeometryUtils } from './utils/geometry';
export { 
  PerformanceMonitor, 
  AdaptiveQualityManager, 
  DeviceCapabilityDetector 
} from './utils/performance';

// Renderers
export { BaseRenderer } from './renderers/BaseRenderer';
export { Canvas2DRenderer } from './renderers/Canvas2DRenderer';

// Default configurations
export const DEFAULT_CANVAS3D_CONFIG: Canvas3DConfig = {
  renderer: 'canvas2d',
  performance: 'balanced',
  features: ['clustering', 'anomalies', 'selection', 'animation', 'connections', 'stats'],
  maxPoints: 50000,
  lodThreshold: 1000,
  frustumCulling: true,
  antialiasing: true
};

export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  rotation: true,
  zoom: true,
  pan: true,
  selection: true,
  autoRotate: true,
  touchGestures: true,
  keyboardShortcuts: true
};

export const DEFAULT_UI_CONFIG: UIConfig = {
  showLegend: true,
  showMinimap: false,
  showStats: true,
  showControls: true,
  showGrid: false,
  theme: 'dark'
};