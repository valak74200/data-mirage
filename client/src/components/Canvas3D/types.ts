/**
 * Canvas3D Unified Types
 * Types et interfaces pour le composant 3D unifié
 */

export interface Point3D {
  id: string;
  position: [number, number, number];
  color: string;
  size: number;
  cluster?: string | number;
  isAnomaly?: boolean;
  originalData?: any;
  opacity?: number;
}

export interface Cluster {
  id: string | number;
  color: string;
  center: [number, number, number];
  points: string[];
  size?: number;
}

export interface ProcessingResult {
  points: Point3D[];
  clusters?: Cluster[];
  anomalies?: string[];
  metadata?: {
    dimensions: number;
    algorithmUsed?: string;
    processingTime?: number;
  };
}

export interface Camera {
  position: [number, number, number];
  rotation: { x: number; y: number; z: number };
  zoom: number;
  target: [number, number, number];
  fov?: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface InteractionState {
  isDragging: boolean;
  isZooming: boolean;
  isPanning: boolean;
  lastPointer: { x: number; y: number };
  pointerCount: number;
}

export interface SelectionState {
  selectedPointId: string | null;
  hoveredPointId: string | null;
  selectedClusterId: string | number | null;
}

export interface AnimationState {
  autoRotate: boolean;
  rotationSpeed: number;
  isAnimating: boolean;
  startTime?: number;
}

export type RendererType = 'webgl' | 'canvas2d';

export type PerformanceMode = 'high' | 'balanced' | 'mobile';

export type FeatureFlag = 
  | 'clustering' 
  | 'anomalies' 
  | 'selection' 
  | 'animation' 
  | 'connections'
  | 'minimap'
  | 'legend'
  | 'stats';

export interface Canvas3DConfig {
  renderer: RendererType;
  performance: PerformanceMode;
  features: FeatureFlag[];
  maxPoints?: number;
  lodThreshold?: number;
  frustumCulling?: boolean;
  antialiasing?: boolean;
}

export interface InteractionConfig {
  rotation: boolean;
  zoom: boolean;
  pan: boolean;
  selection: boolean;
  autoRotate: boolean;
  touchGestures: boolean;
  keyboardShortcuts: boolean;
}

export interface UIConfig {
  showLegend: boolean;
  showMinimap: boolean;
  showStats: boolean;
  showControls: boolean;
  showGrid: boolean;
  theme: 'dark' | 'light';
}

export interface Canvas3DProps {
  data?: ProcessingResult;
  config?: Partial<Canvas3DConfig>;
  interactions?: Partial<InteractionConfig>;
  ui?: Partial<UIConfig>;
  onPointSelect?: (point: Point3D | null) => void;
  onClusterSelect?: (cluster: Cluster | null) => void;
  onCameraChange?: (camera: Camera) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface RendererContext {
  canvas: HTMLCanvasElement;
  viewport: ViewportDimensions;
  camera: Camera;
  config: Canvas3DConfig;
}

export interface ProjectedPoint extends Point3D {
  screenX: number;
  screenY: number;
  screenSize: number;
  depth: number;
  visible: boolean;
  lodLevel: number;
}

export interface RenderStats {
  fps: number;
  frameTime: number;
  pointsRendered: number;
  pointsCulled: number;
  drawCalls: number;
  memoryUsage: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  totalPoints: number;
  visiblePoints: number;
  lodReductions: number;
  frameDrops: number;
}

export interface BaseRenderer {
  init(context: RendererContext): Promise<void>;
  render(points: Point3D[], camera: Camera): void;
  resize(viewport: ViewportDimensions): void;
  dispose(): void;
  getStats(): RenderStats;
  supportsFeature(feature: FeatureFlag): boolean;
}