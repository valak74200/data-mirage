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

export default function Simple3DScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { processingResult, setHoveredPoint } = useVisualizationStore();
  const [rotation, setRotation] = useState({ x: 0.2, y: 0.2 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(true);

  // Process data points with proper spacing
  const points3D = useMemo(() => {
    if (!processingResult?.points) return [];
    
    const spread = 60;
    return processingResult.points.map(point => ({
      x: point.position[0] * spread,
      y: point.position[1] * spread,
      z: point.position[2] * spread,
      screenX: 0,
      screenY: 0,
      size: Math.max(2, point.size * 3),
      color: point.color,
      isAnomaly: point.isAnomaly || false,
      cluster: String(point.cluster || 'none'),
      originalData: point
    }));
  }, [processingResult]);

  // 3D to 2D projection
  const project3DTo2D = useCallback((point: Point3D, width: number, height: number) => {
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);

    // Apply rotation
    const rotatedX = cosY * point.x - sinY * point.z;
    const rotatedY = sinX * sinY * point.x + cosX * point.y + sinX * cosY * point.z;
    const rotatedZ = cosX * sinY * point.x - sinX * point.y + cosX * cosY * point.z;

    // Perspective projection
    const focalLength = 400;
    const perspective = focalLength / (focalLength + rotatedZ + 200);
    
    const screenX = (rotatedX * perspective * zoom) + width / 2;
    const screenY = (-rotatedY * perspective * zoom) + height / 2;
    
    return { 
      screenX, 
      screenY, 
      depth: rotatedZ,
      scale: Math.max(0.2, perspective * zoom)
    };
  }, [rotation, zoom]);

  // Draw the 3D scene
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear with dark background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Add subtle grid
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Project and sort points by depth
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

    // Draw cluster connections
    Object.entries(clusters).forEach(([cluster, clusterPoints]) => {
      if (cluster === 'none' || clusterPoints.length < 2) return;
      
      ctx.strokeStyle = clusterPoints[0].color + '30';
      ctx.lineWidth = 1;
      
      // Connect nearby points
      for (let i = 0; i < clusterPoints.length; i++) {
        for (let j = i + 1; j < clusterPoints.length; j++) {
          const pointA = clusterPoints[i];
          const pointB = clusterPoints[j];
          
          const distance = Math.sqrt(
            Math.pow(pointA.x - pointB.x, 2) +
            Math.pow(pointA.y - pointB.y, 2) +
            Math.pow(pointA.z - pointB.z, 2)
          );
          
          if (distance < 50) {
            ctx.beginPath();
            ctx.moveTo(pointA.screenX, pointA.screenY);
            ctx.lineTo(pointB.screenX, pointB.screenY);
            ctx.stroke();
          }
        }
      }
    });

    // Draw points
    projectedPoints.forEach(point => {
      const size = Math.max(1, point.size * point.scale);
      
      // Glow for anomalies
      if (point.isAnomaly) {
        ctx.shadowColor = point.color;
        ctx.shadowBlur = 15;
      }

      // Main point
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, size, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, size * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow
      ctx.shadowBlur = 0;
    });
  }, [points3D, project3DTo2D]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (autoRotate) {
        setRotation(prev => ({
          x: prev.x + 0.003,
          y: prev.y + 0.005
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
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Mouse controls
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
    setTimeout(() => setAutoRotate(true), 2000);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.3, Math.min(4, prev + e.deltaY * -0.002)));
  }, []);

  if (!processingResult?.points) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">🌌</div>
          <div className="text-xl text-gray-300 mb-2">Visualisation 3D</div>
          <div className="text-sm text-gray-500">
            Uploadez un dataset et générez la visualisation pour voir l'univers 3D
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-gray-900">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3">
        <div className="text-sm text-white space-y-1">
          <div>Points: <span className="text-blue-400">{processingResult.points.length}</span></div>
          <div>Zoom: <span className="text-green-400">{zoom.toFixed(1)}x</span></div>
          <div>Auto-rotation: <span className={autoRotate ? 'text-green-400' : 'text-red-400'}>
            {autoRotate ? 'ON' : 'OFF'}
          </span></div>
        </div>
        
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="mt-2 w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
        >
          {autoRotate ? 'Stop rotation' : 'Start rotation'}
        </button>
      </div>
      
      {/* Controls help */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3">
        <div className="text-xs text-gray-300 space-y-1">
          <div>🖱️ Glisser: Rotation</div>
          <div>⚪ Molette: Zoom</div>
          <div>📱 Touch: Glisser/Pincer</div>
        </div>
      </div>
    </div>
  );
}