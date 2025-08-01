import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useVisualizationStore } from '@/stores/visualization-store';
import { DataPoint } from '@shared/schema';

interface Point3D {
  x: number;
  y: number;
  z: number;
  screenX: number;
  screenY: number;
  size: number;
  color: string;
  isAnomaly: boolean;
  clusterId: string;
  point: DataPoint;
}

export default function ThreeSceneEnhanced() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { processingResult, setHoveredPoint, cameraReset, setCameraReset } = useVisualizationStore();
  const [rotation, setRotation] = useState({ x: 0.3, y: 0.3 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(true);

  // Process and optimize data points
  const { points3D, clusterStats } = useMemo(() => {
    if (!processingResult?.points) return { points3D: [], clusterStats: {} };
    
    const spread = 80; // Optimal spacing
    const points: Point3D[] = [];
    const stats: { [key: string]: { count: number; color: string; center: [number, number, number] } } = {};
    
    processingResult.points.forEach(point => {
      const clusterId = point.clusterId || 'unclustered';
      
      // Initialize cluster stats
      if (!stats[clusterId]) {
        stats[clusterId] = { count: 0, color: point.color, center: [0, 0, 0] };
      }
      stats[clusterId].count++;
      
      const point3D: Point3D = {
        x: point.position[0] * spread,
        y: point.position[1] * spread,
        z: point.position[2] * spread,
        screenX: 0,
        screenY: 0,
        size: Math.max(2, point.size * 4),
        color: point.color,
        isAnomaly: point.isAnomaly || false,
        clusterId,
        point
      };
      
      // Add to cluster center calculation
      stats[clusterId].center[0] += point3D.x;
      stats[clusterId].center[1] += point3D.y;
      stats[clusterId].center[2] += point3D.z;
      
      points.push(point3D);
    });
    
    // Calculate cluster centers
    Object.values(stats).forEach(cluster => {
      cluster.center[0] /= cluster.count;
      cluster.center[1] /= cluster.count;
      cluster.center[2] /= cluster.count;
    });
    
    return { points3D: points, clusterStats: stats };
  }, [processingResult]);

  // Enhanced 3D projection with better perspective
  const project3DTo2D = useCallback((point: Point3D, width: number, height: number) => {
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);

    // Apply rotation
    const rotatedX = cosY * point.x - sinY * point.z;
    const rotatedY = sinX * sinY * point.x + cosX * point.y + sinX * cosY * point.z;
    const rotatedZ = cosX * sinY * point.x - sinX * point.y + cosX * cosY * point.z;

    // Enhanced perspective with better depth
    const focalLength = 300;
    const perspective = focalLength / (focalLength + rotatedZ + 100);
    
    const screenX = (rotatedX * perspective * zoom) + width / 2;
    const screenY = (-rotatedY * perspective * zoom) + height / 2; // Invert Y for screen coordinates
    
    return { 
      screenX, 
      screenY, 
      depth: rotatedZ,
      scale: Math.max(0.3, perspective * zoom),
      alpha: Math.max(0.3, Math.min(1, (perspective + 0.5)))
    };
  }, [rotation, zoom]);

  // Enhanced drawing with better visuals
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear with gradient background
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    gradient.addColorStop(0, 'rgba(10, 10, 15, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    const gridSpacing = 30;
    for (let i = 0; i < width; i += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Project all points and sort by depth
    const projectedPoints = points3D.map(point => ({
      ...point,
      ...project3DTo2D(point, width, height)
    })).sort((a, b) => a.depth - b.depth);

    // Group points by cluster for connections
    const clusterGroups: { [key: string]: typeof projectedPoints } = {};
    projectedPoints.forEach(point => {
      if (!clusterGroups[point.clusterId]) clusterGroups[point.clusterId] = [];
      clusterGroups[point.clusterId].push(point);
    });

    // Draw cluster connections with improved algorithm
    Object.entries(clusterGroups).forEach(([clusterId, clusterPoints]) => {
      if (clusterId === 'unclustered' || clusterPoints.length < 2) return;
      
      ctx.strokeStyle = clusterPoints[0].color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.15;
      
      // Connect points to cluster center for cleaner look
      const centerX = clusterPoints.reduce((sum, p) => sum + p.screenX, 0) / clusterPoints.length;
      const centerY = clusterPoints.reduce((sum, p) => sum + p.screenY, 0) / clusterPoints.length;
      
      clusterPoints.forEach(point => {
        const distance = Math.sqrt(
          Math.pow(point.screenX - centerX, 2) + 
          Math.pow(point.screenY - centerY, 2)
        );
        
        if (distance < 150) { // Only connect nearby points
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(point.screenX, point.screenY);
          ctx.stroke();
        }
      });
    });

    // Draw points with enhanced visuals
    projectedPoints.forEach(point => {
      const size = Math.max(1, point.size * point.scale);
      
      ctx.globalAlpha = point.alpha;
      
      // Enhanced glow for anomalies
      if (point.isAnomaly) {
        ctx.shadowColor = point.color;
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // Main point with gradient
      const pointGradient = ctx.createRadialGradient(
        point.screenX, point.screenY, 0,
        point.screenX, point.screenY, size
      );
      pointGradient.addColorStop(0, point.color);
      pointGradient.addColorStop(0.7, point.color + '80');
      pointGradient.addColorStop(1, point.color + '20');
      
      ctx.fillStyle = pointGradient;
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, size, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright core
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring for anomalies
      if (point.isAnomaly) {
        ctx.strokeStyle = point.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.screenX, point.screenY, size * 1.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Reset shadow
      ctx.shadowBlur = 0;
    });

    ctx.globalAlpha = 1;
  }, [points3D, project3DTo2D]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (autoRotate) {
        setRotation(prev => ({
          x: prev.x + 0.005,
          y: prev.y + 0.003
        }));
      }
      drawScene();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawScene, autoRotate]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Mouse/touch controls
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    setRotation(prev => ({
      x: prev.x + deltaY * 0.01,
      y: prev.y + deltaX * 0.01
    }));
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, [isDragging, lastMousePos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setTimeout(() => setAutoRotate(true), 2000); // Resume auto-rotation after 2s
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.5, Math.min(3, prev + e.deltaY * -0.001)));
  }, []);

  // Reset camera
  useEffect(() => {
    if (cameraReset) {
      setRotation({ x: 0.3, y: 0.3 });
      setZoom(1);
      setAutoRotate(true);
      setCameraReset(false);
    }
  }, [cameraReset, setCameraReset]);

  if (!processingResult?.points) {
    return (
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-purple-900/20 to-black"></div>
        <div className="text-center z-10">
          <div className="text-6xl mb-6 animate-pulse">🌌</div>
          <div className="text-xl text-gray-300 mb-2">Univers 3D en attente</div>
          <div className="text-sm text-gray-500">Uploadez un dataset et générez la visualisation</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      {/* Enhanced stats overlay */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4 min-w-48">
        <div className="text-sm font-medium text-cyan-400 mb-3">STATISTIQUES 3D</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Points totaux:</span>
            <span className="text-white font-mono">{processingResult.points.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Clusters:</span>
            <span className="text-green-400 font-mono">{Object.keys(clusterStats).length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Anomalies:</span>
            <span className="text-red-400 font-mono">{processingResult.points.filter(p => p.isAnomaly).length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Zoom:</span>
            <span className="text-blue-400 font-mono">{zoom.toFixed(1)}x</span>
          </div>
        </div>
        
        {/* Cluster breakdown */}
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">RÉPARTITION CLUSTERS</div>
          <div className="space-y-1">
            {Object.entries(clusterStats).slice(0, 5).map(([id, stats]) => (
              <div key={id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: stats.color }}
                  ></div>
                  <span className="text-xs text-gray-400">
                    {id === 'unclustered' ? 'Non groupé' : `Cluster ${id}`}
                  </span>
                </div>
                <span className="text-xs text-white font-mono">{stats.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Enhanced controls */}
      <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4">
        <div className="text-sm font-medium text-cyan-400 mb-3">CONTRÔLES 3D</div>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <span>🖱️</span>
            <span>Glisser: Rotation manuelle</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>⚪</span>
            <span>Molette: Zoom ({zoom.toFixed(1)}x)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🔄</span>
            <span>Auto-rotation: {autoRotate ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>📱</span>
            <span>Mobile: Touch & pinch</span>
          </div>
        </div>
        
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="mt-3 px-3 py-1 bg-cyan-600/20 border border-cyan-400/30 rounded text-xs text-cyan-400 hover:bg-cyan-600/30 transition-colors"
        >
          {autoRotate ? 'Arrêter rotation' : 'Rotation auto'}
        </button>
      </div>
    </div>
  );
}