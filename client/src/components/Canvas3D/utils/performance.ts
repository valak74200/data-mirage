/**
 * Performance monitoring and optimization utilities
 */

import { PerformanceMetrics, PerformanceMode } from '../types';

export interface PerformanceConfig {
  targetFPS: number;
  maxFrameTime: number;
  adaptiveQuality: boolean;
  memoryThreshold: number;
  profileEnabled: boolean;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    updateTime: 0,
    totalPoints: 0,
    visiblePoints: 0,
    lodReductions: 0,
    frameDrops: 0
  };

  private frameHistory: number[] = [];
  private memoryHistory: number[] = [];
  private lastFrameTime = 0;
  private frameCount = 0;
  private dropThreshold = 16.67; // 60 FPS = 16.67ms per frame
  
  private config: PerformanceConfig = {
    targetFPS: 60,
    maxFrameTime: 16.67,
    adaptiveQuality: true,
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    profileEnabled: false
  };

  constructor(config?: Partial<PerformanceConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.dropThreshold = 1000 / this.config.targetFPS;
  }

  startFrame(): number {
    return performance.now();
  }

  endFrame(startTime: number, pointsRendered: number, totalPoints: number): void {
    const frameTime = performance.now() - startTime;
    this.frameHistory.push(frameTime);
    
    // Keep only last 60 frames
    if (this.frameHistory.length > 60) {
      this.frameHistory.shift();
    }

    // Track frame drops
    if (frameTime > this.dropThreshold) {
      this.metrics.frameDrops++;
    }

    this.metrics.renderTime = frameTime;
    this.metrics.visiblePoints = pointsRendered;
    this.metrics.totalPoints = totalPoints;
    this.frameCount++;
  }

  updateMetrics(updateTime: number, lodReductions: number): void {
    this.metrics.updateTime = updateTime;
    this.metrics.lodReductions = lodReductions;
  }

  getAverageFPS(): number {
    if (this.frameHistory.length === 0) return 0;
    
    const avgFrameTime = this.frameHistory.reduce((sum, time) => sum + time, 0) / this.frameHistory.length;
    return 1000 / avgFrameTime;
  }

  getAverageFrameTime(): number {
    if (this.frameHistory.length === 0) return 0;
    return this.frameHistory.reduce((sum, time) => sum + time, 0) / this.frameHistory.length;
  }

  getPerformanceScore(): number {
    const avgFPS = this.getAverageFPS();
    const frameDropRate = this.metrics.frameDrops / Math.max(1, this.frameCount);
    const renderEfficiency = this.metrics.visiblePoints / Math.max(1, this.metrics.totalPoints);
    
    // Score from 0-100
    const fpsScore = Math.min(100, (avgFPS / this.config.targetFPS) * 100);
    const dropScore = Math.max(0, 100 - (frameDropRate * 1000));
    const efficiencyScore = renderEfficiency * 100;
    
    return (fpsScore * 0.5 + dropScore * 0.3 + efficiencyScore * 0.2);
  }

  shouldReduceQuality(): boolean {
    if (!this.config.adaptiveQuality) return false;
    
    const avgFrameTime = this.getAverageFrameTime();
    const recentDrops = this.frameHistory.slice(-10).filter(time => time > this.dropThreshold).length;
    
    return avgFrameTime > this.config.maxFrameTime || recentDrops > 3;
  }

  shouldIncreaseQuality(): boolean {
    if (!this.config.adaptiveQuality) return false;
    
    const avgFrameTime = this.getAverageFrameTime();
    const recentDrops = this.frameHistory.slice(-30).filter(time => time > this.dropThreshold).length;
    
    return avgFrameTime < this.config.maxFrameTime * 0.7 && recentDrops === 0;
  }

  getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize;
    }
    return 0;
  }

  isMemoryPressure(): boolean {
    const memUsage = this.getMemoryUsage();
    this.memoryHistory.push(memUsage);
    
    if (this.memoryHistory.length > 30) {
      this.memoryHistory.shift();
    }

    return memUsage > this.config.memoryThreshold;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      renderTime: 0,
      updateTime: 0,
      totalPoints: 0,
      visiblePoints: 0,
      lodReductions: 0,
      frameDrops: 0
    };
    this.frameHistory = [];
    this.memoryHistory = [];
    this.frameCount = 0;
  }

  getRecommendedPerformanceMode(): PerformanceMode {
    const score = this.getPerformanceScore();
    const memoryPressure = this.isMemoryPressure();
    
    if (score < 30 || memoryPressure) {
      return 'mobile';
    } else if (score < 70) {
      return 'balanced';
    } else {
      return 'high';
    }
  }

  profile(name: string, fn: () => void): void {
    if (!this.config.profileEnabled) {
      fn();
      return;
    }

    const start = performance.now();
    fn();
    const end = performance.now();
    
    console.log(`Profile [${name}]: ${(end - start).toFixed(2)}ms`);
  }

  async profileAsync(name: string, fn: () => Promise<void>): Promise<void> {
    if (!this.config.profileEnabled) {
      return fn();
    }

    const start = performance.now();
    await fn();
    const end = performance.now();
    
    console.log(`Profile [${name}]: ${(end - start).toFixed(2)}ms`);
  }

  logStats(): void {
    if (!this.config.profileEnabled) return;

    console.group('Performance Stats');
    console.log(`FPS: ${this.getAverageFPS().toFixed(1)}`);
    console.log(`Frame Time: ${this.getAverageFrameTime().toFixed(2)}ms`);
    console.log(`Performance Score: ${this.getPerformanceScore().toFixed(1)}/100`);
    console.log(`Frame Drops: ${this.metrics.frameDrops}`);
    console.log(`Points Rendered: ${this.metrics.visiblePoints}/${this.metrics.totalPoints}`);
    console.log(`LOD Reductions: ${this.metrics.lodReductions}`);
    console.log(`Memory Usage: ${(this.getMemoryUsage() / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Recommended Mode: ${this.getRecommendedPerformanceMode()}`);
    console.groupEnd();
  }
}

// Adaptive Quality Manager
export class AdaptiveQualityManager {
  private monitor: PerformanceMonitor;
  private currentLODScale = 1.0;
  private currentMaxPoints = 50000;
  private adaptationCooldown = 0;
  private lastAdaptation = 0;

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
  }

  update(): boolean {
    const now = performance.now();
    
    // Cooldown to prevent rapid changes
    if (now - this.lastAdaptation < this.adaptationCooldown) {
      return false;
    }

    let adapted = false;

    if (this.monitor.shouldReduceQuality()) {
      this.reduceQuality();
      adapted = true;
      this.adaptationCooldown = 2000; // 2 second cooldown after reduction
    } else if (this.monitor.shouldIncreaseQuality()) {
      this.increaseQuality();
      adapted = true;
      this.adaptationCooldown = 5000; // 5 second cooldown after increase
    }

    if (adapted) {
      this.lastAdaptation = now;
    }

    return adapted;
  }

  private reduceQuality(): void {
    // Reduce LOD scale
    this.currentLODScale = Math.max(0.25, this.currentLODScale * 0.8);
    
    // Reduce max points
    this.currentMaxPoints = Math.max(5000, Math.floor(this.currentMaxPoints * 0.7));

    console.log(`Quality reduced: LOD=${this.currentLODScale.toFixed(2)}, MaxPoints=${this.currentMaxPoints}`);
  }

  private increaseQuality(): void {
    // Increase LOD scale
    this.currentLODScale = Math.min(1.0, this.currentLODScale * 1.1);
    
    // Increase max points
    this.currentMaxPoints = Math.min(100000, Math.floor(this.currentMaxPoints * 1.2));

    console.log(`Quality increased: LOD=${this.currentLODScale.toFixed(2)}, MaxPoints=${this.currentMaxPoints}`);
  }

  getLODScale(): number {
    return this.currentLODScale;
  }

  getMaxPoints(): number {
    return this.currentMaxPoints;
  }

  reset(): void {
    this.currentLODScale = 1.0;
    this.currentMaxPoints = 50000;
    this.adaptationCooldown = 0;
    this.lastAdaptation = 0;
  }
}

// Device capability detection
export class DeviceCapabilityDetector {
  private static cachedDeviceClass: 'high-end' | 'mid-range' | 'low-end' | null = null;
  private static cachedWebGL2Support: boolean | null = null;
  private static testCanvas: HTMLCanvasElement | null = null;
  private static testContext: WebGLRenderingContext | WebGL2RenderingContext | null = null;

  private static createTestContext(): WebGLRenderingContext | null {
    if (this.testContext) return this.testContext as WebGLRenderingContext;

    if (!this.testCanvas) {
      this.testCanvas = document.createElement('canvas');
      // Set small size to minimize memory usage
      this.testCanvas.width = 1;
      this.testCanvas.height = 1;
    }

    // Try to get existing context first, then create new one
    const gl = this.testCanvas.getContext('webgl') as WebGLRenderingContext | null || 
               this.testCanvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    
    this.testContext = gl;
    return gl;
  }

  private static disposeTestContext(): void {
    if (this.testContext) {
      // Properly dispose WebGL context
      const gl = this.testContext as WebGLRenderingContext;
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
      this.testContext = null;
    }
    
    if (this.testCanvas) {
      // Clear canvas dimensions to free memory
      this.testCanvas.width = 0;
      this.testCanvas.height = 0;
      this.testCanvas = null;
    }
  }

  static getDeviceClass(): 'high-end' | 'mid-range' | 'low-end' {
    // Return cached result if available
    if (this.cachedDeviceClass !== null) {
      return this.cachedDeviceClass;
    }

    const gl = this.createTestContext();
    
    if (!gl) {
      this.cachedDeviceClass = 'low-end';
      return this.cachedDeviceClass;
    }

    // Check hardware concurrency
    const cores = navigator.hardwareConcurrency || 2;
    
    // Check memory (if available)
    const memory = (navigator as any).deviceMemory || 4;
    
    // Check WebGL extensions
    const extensions = gl.getSupportedExtensions()?.length || 0;
    
    // Score based on capabilities
    let score = 0;
    score += cores >= 8 ? 3 : cores >= 4 ? 2 : 1;
    score += memory >= 8 ? 3 : memory >= 4 ? 2 : 1;
    score += extensions >= 30 ? 2 : extensions >= 20 ? 1 : 0;
    
    if (score >= 7) {
      this.cachedDeviceClass = 'high-end';
    } else if (score >= 4) {
      this.cachedDeviceClass = 'mid-range';
    } else {
      this.cachedDeviceClass = 'low-end';
    }
    
    // Clean up context after detection is complete
    this.scheduleCleanup();
    
    return this.cachedDeviceClass;
  }

  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  static supportsWebGL2(): boolean {
    // Return cached result if available
    if (this.cachedWebGL2Support !== null) {
      return this.cachedWebGL2Support;
    }

    if (!this.testCanvas) {
      this.testCanvas = document.createElement('canvas');
      this.testCanvas.width = 1;
      this.testCanvas.height = 1;
    }

    // Test WebGL2 support
    const gl2 = this.testCanvas.getContext('webgl2');
    this.cachedWebGL2Support = !!gl2;

    // Dispose the WebGL2 context immediately if it was created
    if (gl2) {
      const loseContext = gl2.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }

    return this.cachedWebGL2Support;
  }

  private static scheduleCleanup(): void {
    // Schedule cleanup after a short delay to allow any other capability checks
    setTimeout(() => {
      this.disposeTestContext();
    }, 100);
  }

  static dispose(): void {
    this.disposeTestContext();
    this.cachedDeviceClass = null;
    this.cachedWebGL2Support = null;
  }

  static getRecommendedSettings(): {
    performanceMode: PerformanceMode;
    maxPoints: number;
    enableLOD: boolean;
    enableAntialiasing: boolean;
  } {
    const deviceClass = this.getDeviceClass();
    const isMobile = this.isMobile();

    if (isMobile || deviceClass === 'low-end') {
      return {
        performanceMode: 'mobile',
        maxPoints: 5000,
        enableLOD: true,
        enableAntialiasing: false
      };
    } else if (deviceClass === 'mid-range') {
      return {
        performanceMode: 'balanced',
        maxPoints: 25000,
        enableLOD: true,
        enableAntialiasing: true
      };
    } else {
      return {
        performanceMode: 'high',
        maxPoints: 100000,
        enableLOD: false,
        enableAntialiasing: true
      };
    }
  }
}