import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useVisualizationStore } from '@/stores/visualization-store';

interface Point3D {
  x: number;
  y: number;
  z: number;
  screenX: number;
  screenY: number;
  size: number;
  color: string;
  isAnomaly: boolean;
  cluster: string;
  originalData: any;
}

export default function Mobile3DScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { processingResult, setHoveredPoint } = useVisualizationStore();
  const [rotation, setRotation] = useState({ x: 0.2, y: 0.2 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchPos, setLastTouchPos] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(true);

  // Process data points with optimal mobile spacing
  const points3D = useMemo(() => {
    if (!processingResult?.points) return [];
    
    const spread = 40; // Reduced for mobile
    return processingResult.points.map(point => ({
      x: point.position[0] * spread,
      y: point.position[1] * spread,
      z: point.position[2] * spread,
      screenX: 0,
      screenY: 0,
      size: Math.max(3, point.size * 4), // Larger points for mobile
      color: point.color,
      isAnomaly: point.isAnomaly || false,
      cluster: String(point.cluster || 'none'),
      originalData: point
    }));
  }, [processingResult]);

  // 3D to 2D projection optimized for mobile
  const project3DTo2D = useCallback((point: Point3D, width: number, height: number) => {
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);

    // Apply rotation
    const rotatedX = cosY * point.x - sinY * point.z;
    const rotatedY = sinX * sinY * point.x + cosX * point.y + sinX * cosY * point.z;
    const rotatedZ = cosX * sinY * point.x - sinX * point.y + cosX * cosY * point.z;

    // Mobile-optimized perspective
    const focalLength = 300;
    const perspective = focalLength / (focalLength + rotatedZ + 150);
    
    const screenX = (rotatedX * perspective * zoom) + width / 2;
    const screenY = (-rotatedY * perspective * zoom) + height / 2;
    
    return { 
      screenX, 
      screenY, 
      depth: rotatedZ,
      scale: Math.max(0.3, perspective * zoom)
    };
  }, [rotation, zoom]);

  // Optimized drawing for mobile performance
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear with gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0a0a0f');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Simplified grid for mobile
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.08)';
    ctx.lineWidth = 0.5;
    const gridSize = 60;
    for (let i = 0; i < width; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Project and sort points
    const projectedPoints = points3D.map(point => ({
      ...point,
      ...project3DTo2D(point, width, height)
    })).sort((a, b) => a.depth - b.depth);

    // Group by cluster for connections
    const clusters: { [key: string]: typeof projectedPoints } = {};
    projectedPoints.forEach(point => {
      if (!clusters[point.cluster]) clusters[point.cluster] = [];
      clusters[point.cluster].push(point);
    });

    // Draw cluster connections (simplified for mobile)
    Object.entries(clusters).forEach(([cluster, clusterPoints]) => {
      if (cluster === 'none' || clusterPoints.length < 2) return;
      
      ctx.strokeStyle = clusterPoints[0].color + '20';
      ctx.lineWidth = 1;
      
      // Only connect very close points on mobile
      for (let i = 0; i < Math.min(clusterPoints.length, 10); i++) {
        for (let j = i + 1; j < Math.min(clusterPoints.length, 10); j++) {
          const pointA = clusterPoints[i];
          const pointB = clusterPoints[j];
          
          const screenDistance = Math.sqrt(
            Math.pow(pointA.screenX - pointB.screenX, 2) +
            Math.pow(pointA.screenY - pointB.screenY, 2)
          );
          
          if (screenDistance < 80) {
            ctx.beginPath();
            ctx.moveTo(pointA.screenX, pointA.screenY);
            ctx.lineTo(pointB.screenX, pointB.screenY);
            ctx.stroke();
          }
        }
      }
    });

    // Draw points with mobile-optimized rendering
    projectedPoints.forEach(point => {
      const size = Math.max(2, point.size * point.scale);
      
      // Enhanced glow for anomalies
      if (point.isAnomaly) {
        ctx.shadowColor = point.color;
        ctx.shadowBlur = 20;
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

      // Bright center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, size * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow
      ctx.shadowBlur = 0;
    });
  }, [points3D, project3DTo2D]);

  // Mobile-optimized animation
  useEffect(() => {
    const animate = () => {
      if (autoRotate) {
        setRotation(prev => ({
          x: prev.x + 0.002,
          y: prev.y + 0.004
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

  // Mobile canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Touch controls for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      setIsDragging(true);
      setAutoRotate(false);
      const touch = e.touches[0];
      setLastTouchPos({ x: touch.clientX, y: touch.clientY });
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging) {
      // Single finger rotation
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastTouchPos.x;
      const deltaY = touch.clientY - lastTouchPos.y;
      
      setRotation(prev => ({
        x: prev.x + deltaY * 0.01,
        y: prev.y + deltaX * 0.01
      }));
      
      setLastTouchPos({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      // Simple zoom based on distance
      const baseDistance = 100;
      const zoomFactor = distance / baseDistance;
      setZoom(Math.max(0.3, Math.min(3, zoomFactor)));
    }
  }, [isDragging, lastTouchPos]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setTimeout(() => setAutoRotate(true), 3000);
  }, []);

  if (!processingResult?.points || processingResult.points.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 to-purple-900">
        <div className="text-center p-6">
          <div className="text-6xl mb-6">🌌</div>
          <div className="text-2xl text-white mb-4 font-light">Visualisation 3D</div>
          <div className="text-gray-400 text-center max-w-xs">
            Uploadez un dataset et générez la visualisation pour découvrir l'univers 3D
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      />
      
      {/* Mobile-optimized stats */}
      <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-sm rounded-lg p-2">
        <div className="text-xs text-white space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span>{processingResult.points.length}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>{processingResult.clusters?.length || 0}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${autoRotate ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-xs">{autoRotate ? 'AUTO' : 'MANUAL'}</span>
          </div>
        </div>
      </div>
      
      {/* Mobile controls help */}
      <div className="absolute bottom-2 left-2 bg-black/90 backdrop-blur-sm rounded-lg p-2">
        <div className="text-xs text-gray-300 space-y-1">
          <div>👆 Glisser: Rotation</div>
          <div>🤏 Pincer: Zoom</div>
        </div>
      </div>

      {/* Toggle auto-rotate button for mobile */}
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-medium"
      >
        {autoRotate ? 'PAUSE' : 'AUTO'}
      </button>
    </div>
  );
}