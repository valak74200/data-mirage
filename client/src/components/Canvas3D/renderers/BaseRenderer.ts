/**
 * BaseRenderer - Interface commune pour tous les renderers
 */

import { 
  BaseRenderer as IBaseRenderer, 
  RendererContext, 
  Point3D, 
  Camera, 
  ViewportDimensions, 
  RenderStats,
  FeatureFlag,
  PerformanceMode
} from '../types';

export abstract class BaseRenderer implements IBaseRenderer {
  protected context?: RendererContext;
  protected isInitialized = false;
  protected stats: RenderStats = {
    fps: 0,
    frameTime: 0,
    pointsRendered: 0,
    pointsCulled: 0,
    drawCalls: 0,
    memoryUsage: 0
  };

  protected performanceMode: PerformanceMode = 'balanced';
  protected maxRenderPoints = 50000;
  protected lodEnabled = true;
  
  protected lastFrameTime = 0;
  protected frameCount = 0;
  protected fpsUpdateInterval = 1000; // Update FPS every second
  protected lastFpsUpdate = 0;

  async init(context: RendererContext): Promise<void> {
    this.context = context;
    this.performanceMode = context.config.performance;
    this.setupPerformanceSettings();
    await this.initRenderer();
    this.isInitialized = true;
  }

  protected setupPerformanceSettings(): void {
    switch (this.performanceMode) {
      case 'high':
        this.maxRenderPoints = 100000;
        this.lodEnabled = false;
        break;
      case 'balanced':
        this.maxRenderPoints = 50000;
        this.lodEnabled = true;
        break;
      case 'mobile':
        this.maxRenderPoints = 10000;
        this.lodEnabled = true;
        break;
    }
  }

  abstract initRenderer(): Promise<void>;
  abstract render(points: Point3D[], camera: Camera): void;
  abstract resize(viewport: ViewportDimensions): void;
  abstract dispose(): void;
  abstract supportsFeature(feature: FeatureFlag): boolean;

  protected updateStats(renderTime: number, pointsRendered: number, pointsCulled: number): void {
    const now = performance.now();
    
    this.stats.frameTime = renderTime;
    this.stats.pointsRendered = pointsRendered;
    this.stats.pointsCulled = pointsCulled;
    
    // Update FPS
    this.frameCount++;
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.stats.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  protected shouldRenderPoint(point: Point3D, camera: Camera): boolean {
    // Basic frustum culling
    if (!this.context) return true;
    
    const distance = Math.sqrt(
      Math.pow(point.position[0] - camera.position[0], 2) +
      Math.pow(point.position[1] - camera.position[1], 2) +
      Math.pow(point.position[2] - camera.position[2], 2)
    );

    // Don't render points too far away
    const maxDistance = 1000 / camera.zoom;
    return distance <= maxDistance;
  }

  protected calculateLOD(point: Point3D, camera: Camera): number {
    if (!this.lodEnabled) return 1;

    const distance = Math.sqrt(
      Math.pow(point.position[0] - camera.position[0], 2) +
      Math.pow(point.position[1] - camera.position[1], 2) +
      Math.pow(point.position[2] - camera.position[2], 2)
    );

    // LOD levels: 1 (full detail), 0.5 (half detail), 0.25 (quarter detail)
    if (distance < 100) return 1;
    if (distance < 300) return 0.5;
    return 0.25;
  }

  protected project3DToScreen(
    point: Point3D, 
    camera: Camera, 
    viewport: ViewportDimensions
  ): { x: number; y: number; z: number; size: number } {
    // Enhanced 3D to 2D projection with proper camera transforms
    const { position, rotation, zoom } = camera;
    const { width, height } = viewport;

    // Translate to camera space
    let x = point.position[0] - position[0];
    let y = point.position[1] - position[1];
    let z = point.position[2] - position[2];

    // Apply camera rotation
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);
    const cosZ = Math.cos(rotation.z || 0);
    const sinZ = Math.sin(rotation.z || 0);

    // Rotate around Y axis
    const tempX = x * cosY - z * sinY;
    const tempZ = x * sinY + z * cosY;
    x = tempX;
    z = tempZ;

    // Rotate around X axis
    const tempY = y * cosX - z * sinX;
    z = y * sinX + z * cosX;
    y = tempY;

    // Rotate around Z axis
    const finalX = x * cosZ - y * sinZ;
    const finalY = x * sinZ + y * cosZ;
    x = finalX;
    y = finalY;

    // Perspective projection
    const focalLength = 400;
    const perspective = focalLength / (focalLength + z);
    
    const screenX = (x * perspective * zoom) + width / 2;
    const screenY = (-y * perspective * zoom) + height / 2; // Flip Y for screen coords
    
    const size = Math.max(1, (point.size || 4) * perspective * zoom);

    return { x: screenX, y: screenY, z, size };
  }

  getStats(): RenderStats {
    return { ...this.stats };
  }

  protected checkInitialized(): void {
    if (!this.isInitialized || !this.context) {
      throw new Error('Renderer not initialized. Call init() first.');
    }
  }
}