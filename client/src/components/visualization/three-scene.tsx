import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useVisualizationStore } from "@/stores/visualization-store";
import { DataPoint } from "@shared/schema";
import { motion } from "framer-motion";

interface Point3D {
  x: number;
  y: number;
  z: number;
  screenX: number;
  screenY: number;
  size: number;
  color: string;
  isAnomaly: boolean;
  point: DataPoint;
}

export default function ThreeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { processingResult, setHoveredPoint, cameraReset, setCameraReset } = useVisualizationStore();
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

  const points3D = useMemo(() => {
    if (!processingResult?.points) return [];
    
    return processingResult.points.map(point => ({
      x: point.position[0],
      y: point.position[1], 
      z: point.position[2],
      screenX: 0,
      screenY: 0,
      size: Math.max(2, point.size * 5),
      color: point.color,
      isAnomaly: point.isAnomaly || false,
      point
    }));
  }, [processingResult]);

  const project3DTo2D = useCallback((point3D: Point3D, width: number, height: number) => {
    // Simple 3D to 2D projection with rotation
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);

    // Apply rotation
    const rotatedX = cosY * point3D.x - sinY * point3D.z;
    const rotatedY = sinX * sinY * point3D.x + cosX * point3D.y + sinX * cosY * point3D.z;
    const rotatedZ = cosX * sinY * point3D.x - sinX * point3D.y + cosX * cosY * point3D.z;

    // Apply zoom and perspective
    const distance = 200;
    const perspective = distance / (distance + rotatedZ * zoom);
    
    const screenX = (rotatedX * perspective * zoom) + width / 2;
    const screenY = (rotatedY * perspective * zoom) + height / 2;

    return { 
      screenX, 
      screenY, 
      depth: rotatedZ,
      scale: perspective * zoom 
    };
  }, [rotation, zoom]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let i = -10; i <= 10; i++) {
      const pos = i * gridSize;
      const { screenX: x1, screenY: y1 } = project3DTo2D({ x: pos, y: 0, z: -200 } as Point3D, width, height);
      const { screenX: x2, screenY: y2 } = project3DTo2D({ x: pos, y: 0, z: 200 } as Point3D, width, height);
      const { screenX: x3, screenY: y3 } = project3DTo2D({ x: -200, y: 0, z: pos } as Point3D, width, height);
      const { screenX: x4, screenY: y4 } = project3DTo2D({ x: 200, y: 0, z: pos } as Point3D, width, height);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }

    // Project and sort points by depth
    const projectedPoints = points3D.map(point => ({
      ...point,
      ...project3DTo2D(point, width, height)
    })).sort((a, b) => a.depth - b.depth);

    // Draw points
    projectedPoints.forEach(point => {
      const size = Math.max(2, point.size * point.scale);
      
      // Draw glow for anomalies
      if (point.isAnomaly) {
        ctx.shadowColor = point.color;
        ctx.shadowBlur = 15;
      }

      // Draw main point
      ctx.fillStyle = point.color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, size, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow
      ctx.shadowBlur = 0;
      
      // Draw highlight ring for anomalies
      if (point.isAnomaly) {
        ctx.strokeStyle = point.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(point.screenX, point.screenY, size + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    });
  }, [points3D, project3DTo2D]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    if ('touches' in e) {
      if (e.touches.length === 2) {
        // Pinch gesture
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        setLastTouchDistance(distance);
      } else {
        // Single touch
        setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    } else {
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if ('touches' in e) {
      if (e.touches.length === 2) {
        // Handle pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (lastTouchDistance > 0) {
          const scaleFactor = distance / lastTouchDistance;
          setZoom(prev => Math.max(0.1, Math.min(5, prev * scaleFactor)));
        }
        setLastTouchDistance(distance);
      } else if (isDragging && e.touches.length === 1) {
        // Single touch rotation
        const clientX = e.touches[0].clientX;
        const clientY = e.touches[0].clientY;
        const deltaX = clientX - lastMousePos.x;
        const deltaY = clientY - lastMousePos.y;
        
        setRotation(prev => ({
          x: prev.x + deltaY * 0.01,
          y: prev.y + deltaX * 0.01
        }));
        
        setLastMousePos({ x: clientX, y: clientY });
      }
    } else {
      // Mouse handling
      const clientX = e.clientX;
      const clientY = e.clientY;
      
      if (isDragging) {
        const deltaX = clientX - lastMousePos.x;
        const deltaY = clientY - lastMousePos.y;
        
        setRotation(prev => ({
          x: prev.x + deltaY * 0.01,
          y: prev.y + deltaX * 0.01
        }));
        
        setLastMousePos({ x: clientX, y: clientY });
      } else {
      // Handle hover detection
      const canvas = canvasRef.current;
      if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

      // Find closest point
      let closestPoint: DataPoint | null = null;
      let minDistance = 30; // Hover threshold

      const projectedPoints = points3D.map(point => ({
        ...point,
        ...project3DTo2D(point, canvas.width, canvas.height)
      }));

      projectedPoints.forEach(point => {
        const distance = Math.sqrt(
          Math.pow(mouseX - point.screenX, 2) + 
          Math.pow(mouseY - point.screenY, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point.point;
        }
      });

        setHoveredPoint(closestPoint);
      }
    }
  };

  const handleMouseUp = (e?: React.TouchEvent) => {
    setIsDragging(false);
    setLastTouchDistance(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(5, prev * zoomDelta)));
  };

  // Reset camera when requested
  useEffect(() => {
    if (cameraReset) {
      setRotation({ x: 0.3, y: 0.5 });
      setZoom(1);
      setCameraReset(false);
    }
  }, [cameraReset, setCameraReset]);

  // Redraw when state changes
  useEffect(() => {
    drawScene();
  }, [drawScene]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        drawScene();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawScene]);

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        style={{ background: 'transparent' }}
      />
      
      {/* Floating particles background */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full opacity-30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
      
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500">
        <div>Touch & drag to rotate</div>
        <div>Pinch to zoom</div>
      </div>
    </div>
  );
}
