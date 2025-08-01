/**
 * Canvas2DRenderer - Fallback renderer haute performance pour mobile
 */

import { BaseRenderer } from './BaseRenderer';
import { Point3D, Camera, ViewportDimensions, FeatureFlag, ProjectedPoint } from '../types';

export class Canvas2DRenderer extends BaseRenderer {
  private ctx?: CanvasRenderingContext2D;
  private offscreenCanvas?: HTMLCanvasElement;
  private offscreenCtx?: CanvasRenderingContext2D;
  private imageCache = new Map<string, ImageData>();
  private gradientCache = new Map<string, CanvasGradient>();

  async initRenderer(): Promise<void> {
    if (!this.context?.canvas) {
      throw new Error('Canvas context required for Canvas2DRenderer');
    }

    this.ctx = this.context.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Could not get 2D rendering context');
    }

    // Create offscreen canvas for double buffering
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    if (!this.offscreenCtx) {
      throw new Error('Could not get offscreen 2D rendering context');
    }

    // Setup high-DPI support
    this.setupHighDPI();

    console.log('Canvas2DRenderer initialized');
  }

  private setupHighDPI(): void {
    if (!this.ctx || !this.context) return;

    const { canvas, viewport } = this.context;
    const { devicePixelRatio } = viewport;

    // Scale canvas for high-DPI displays
    canvas.width = viewport.width * devicePixelRatio;
    canvas.height = viewport.height * devicePixelRatio;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';

    this.ctx.scale(devicePixelRatio, devicePixelRatio);

    // Setup offscreen canvas
    if (this.offscreenCanvas && this.offscreenCtx) {
      this.offscreenCanvas.width = canvas.width;
      this.offscreenCanvas.height = canvas.height;
      this.offscreenCtx.scale(devicePixelRatio, devicePixelRatio);
    }
  }

  render(points: Point3D[], camera: Camera): void {
    this.checkInitialized();
    if (!this.ctx || !this.context) return;

    const startTime = performance.now();
    const { viewport } = this.context;
    
    // Use offscreen rendering for better performance
    const renderCtx = this.offscreenCtx || this.ctx;
    const { width, height } = viewport;

    this.clearCanvas(renderCtx, width, height);

    // Project all points to screen space with culling
    const projectedPoints = this.projectAndCullPoints(points, camera, viewport);
    
    // Sort by depth (back to front)
    projectedPoints.sort((a, b) => a.depth - b.depth);

    // Render in batches for better performance
    this.renderPointsBatched(renderCtx, projectedPoints);

    // Copy offscreen to main canvas if using double buffering
    if (this.offscreenCtx && this.offscreenCanvas) {
      this.ctx.clearRect(0, 0, width, height);
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    // Update performance stats
    const renderTime = performance.now() - startTime;
    this.updateStats(renderTime, projectedPoints.length, points.length - projectedPoints.length);
  }

  private clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Create space-like gradient background
    const gradient = this.getCachedGradient('background', ctx, width, height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Optional: Draw subtle grid
    if (this.context?.config.features.includes('stats')) {
      this.drawGrid(ctx, width, height);
    }
  }

  private getCachedGradient(
    key: string, 
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number
  ): CanvasGradient {
    const cacheKey = `${key}-${width}-${height}`;
    
    if (!this.gradientCache.has(cacheKey)) {
      let gradient: CanvasGradient;
      
      switch (key) {
        case 'background':
          gradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) / 2
          );
          gradient.addColorStop(0, '#0a0a0f');
          gradient.addColorStop(0.5, '#1a1a2e');
          gradient.addColorStop(1, '#000000');
          break;
        default:
          gradient = ctx.createLinearGradient(0, 0, width, height);
          gradient.addColorStop(0, '#000000');
          gradient.addColorStop(1, '#1a1a2e');
      }
      
      this.gradientCache.set(cacheKey, gradient);
    }
    
    return this.gradientCache.get(cacheKey)!;
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.05)';
    ctx.lineWidth = 0.5;
    
    const gridSize = this.performanceMode === 'mobile' ? 80 : 40;
    
    // Draw vertical lines
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private projectAndCullPoints(
    points: Point3D[], 
    camera: Camera, 
    viewport: ViewportDimensions
  ): ProjectedPoint[] {
    const projectedPoints: ProjectedPoint[] = [];
    let culledCount = 0;

    for (const point of points) {
      // Basic frustum culling
      if (!this.shouldRenderPoint(point, camera)) {
        culledCount++;
        continue;
      }

      const projected = this.project3DToScreen(point, camera, viewport);
      
      // Screen bounds culling
      if (projected.x < -50 || projected.x > viewport.width + 50 ||
          projected.y < -50 || projected.y > viewport.height + 50) {
        culledCount++;
        continue;
      }

      const lodLevel = this.calculateLOD(point, camera);
      
      projectedPoints.push({
        ...point,
        screenX: projected.x,
        screenY: projected.y,
        screenSize: projected.size * lodLevel,
        depth: projected.z,
        visible: true,
        lodLevel
      });
    }

    return projectedPoints;
  }

  private renderPointsBatched(ctx: CanvasRenderingContext2D, points: ProjectedPoint[]): void {
    // Group points by color and size for batch rendering
    const batches = new Map<string, ProjectedPoint[]>();
    
    for (const point of points) {
      const batchKey = `${point.color}-${Math.round(point.screenSize)}-${point.isAnomaly ? 'anomaly' : 'normal'}`;
      
      if (!batches.has(batchKey)) {
        batches.set(batchKey, []);
      }
      batches.get(batchKey)!.push(point);
    }

    // Render each batch
    for (const [batchKey, batchPoints] of batches) {
      this.renderPointBatch(ctx, batchPoints);
    }

    // Render connections if enabled
    if (this.context?.config.features.includes('connections')) {
      this.renderConnections(ctx, points);
    }
  }

  private renderPointBatch(ctx: CanvasRenderingContext2D, points: ProjectedPoint[]): void {
    if (points.length === 0) return;

    const firstPoint = points[0];
    const isAnomaly = firstPoint.isAnomaly;
    const color = firstPoint.color;
    const size = Math.max(1, firstPoint.screenSize);

    // Set up rendering style
    ctx.fillStyle = color;
    
    if (isAnomaly) {
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.min(20, size * 2);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Render all points in this batch
    ctx.beginPath();
    for (const point of points) {
      if (point.lodLevel < 0.25 && this.performanceMode === 'mobile') {
        // Skip very small LOD points on mobile
        continue;
      }

      ctx.moveTo(point.screenX + point.screenSize, point.screenY);
      ctx.arc(point.screenX, point.screenY, point.screenSize, 0, Math.PI * 2);
    }
    ctx.fill();

    // Add highlights for high-quality rendering
    if (this.performanceMode !== 'mobile' && size > 3) {
      ctx.fillStyle = '#ffffff40';
      ctx.shadowBlur = 0;
      
      ctx.beginPath();
      for (const point of points) {
        const highlightSize = point.screenSize * 0.3;
        const offsetX = point.screenX - point.screenSize * 0.3;
        const offsetY = point.screenY - point.screenSize * 0.3;
        
        ctx.moveTo(offsetX + highlightSize, offsetY);
        ctx.arc(offsetX, offsetY, highlightSize, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  private renderConnections(ctx: CanvasRenderingContext2D, points: ProjectedPoint[]): void {
    // Group points by cluster
    const clusters = new Map<string | number, ProjectedPoint[]>();
    
    for (const point of points) {
      if (!point.cluster) continue;
      
      if (!clusters.has(point.cluster)) {
        clusters.set(point.cluster, []);
      }
      clusters.get(point.cluster)!.push(point);
    }

    // Draw connections within clusters
    for (const [clusterId, clusterPoints] of clusters) {
      if (clusterPoints.length < 2) continue;
      
      ctx.strokeStyle = clusterPoints[0].color + (this.performanceMode === 'mobile' ? '15' : '25');
      ctx.lineWidth = this.performanceMode === 'mobile' ? 0.5 : 1;

      // Limit connections for performance
      const maxConnections = this.performanceMode === 'mobile' ? 5 : 15;
      const connectionsPerPoint = Math.min(2, Math.floor(maxConnections / clusterPoints.length));

      for (let i = 0; i < clusterPoints.length && i < maxConnections; i++) {
        const point = clusterPoints[i];
        
        // Connect to nearest neighbors
        const distances = clusterPoints
          .filter((_, j) => j !== i)
          .map((other, j) => ({
            point: other,
            distance: Math.sqrt(
              Math.pow(point.screenX - other.screenX, 2) +
              Math.pow(point.screenY - other.screenY, 2)
            ),
            index: j
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, connectionsPerPoint);

        for (const { point: nearbyPoint, distance } of distances) {
          if (distance < 150) { // Only connect nearby points
            ctx.beginPath();
            ctx.moveTo(point.screenX, point.screenY);
            ctx.lineTo(nearbyPoint.screenX, nearbyPoint.screenY);
            ctx.stroke();
          }
        }
      }
    }
  }

  resize(viewport: ViewportDimensions): void {
    this.checkInitialized();
    if (!this.context) return;

    this.context.viewport = viewport;
    this.setupHighDPI();
    
    // Clear caches
    this.gradientCache.clear();
    this.imageCache.clear();
  }

  dispose(): void {
    // Clear all caches to free memory
    this.gradientCache.clear();
    this.imageCache.clear();
    
    // Properly dispose of offscreen canvas
    if (this.offscreenCanvas) {
      // Clear the canvas content
      if (this.offscreenCtx) {
        this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
      }
      // Reset canvas dimensions to free memory
      this.offscreenCanvas.width = 0;
      this.offscreenCanvas.height = 0;
      this.offscreenCanvas = undefined;
      this.offscreenCtx = undefined;
    }
    
    // Clear main canvas context if we have access to the canvas
    if (this.ctx && this.context?.canvas) {
      this.ctx.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    }
    
    this.ctx = undefined;
    this.isInitialized = false;
  }

  supportsFeature(feature: FeatureFlag): boolean {
    const supportedFeatures: FeatureFlag[] = [
      'clustering',
      'anomalies',
      'selection',
      'animation',
      'connections',
      'stats'
    ];

    return supportedFeatures.includes(feature);
  }
}