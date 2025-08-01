import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface ProcessingResult {
  points: Array<{
    id: string;
    position: [number, number, number];
    color: string;
    cluster: number;
    originalData: any;
  }>;
  clusters: Array<{
    id: number;
    color: string;
    center: [number, number, number];
    points: string[];
  }>;
  anomalies: string[];
}

interface Canvas3DOptimizedProps {
  processingResult?: ProcessingResult;
}

export default function Canvas3DOptimized({ processingResult }: Canvas3DOptimizedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const rotationRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(2);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const animationRef = useRef<number>();

  // Simple 3D projection function
  const project3D = useCallback((x: number, y: number, z: number, canvas: HTMLCanvasElement) => {
    const perspective = 800;
    const scale = 200 * zoom;
    
    // Apply rotation
    const cosX = Math.cos(rotationRef.current.x);
    const sinX = Math.sin(rotationRef.current.x);
    const cosY = Math.cos(rotationRef.current.y);
    const sinY = Math.sin(rotationRef.current.y);
    
    // Rotate around Y axis then X axis
    const rotatedX = x * cosY - z * sinY;
    const rotatedZ = x * sinY + z * cosY;
    const rotatedY = y * cosX - rotatedZ * sinX;
    const finalZ = y * sinX + rotatedZ * cosX;
    
    // Project to 2D
    const projectedX = (rotatedX * perspective) / (perspective + finalZ) * scale + canvas.width / 2;
    const projectedY = (rotatedY * perspective) / (perspective + finalZ) * scale + canvas.height / 2;
    const size = (perspective) / (perspective + finalZ) * 12;
    
    return { x: projectedX, y: projectedY, size: Math.max(4, size), depth: finalZ };
  }, [zoom]);

  const draw = useCallback(() => {
    if (!canvasRef.current || !processingResult?.points) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with space background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e293b');
    gradient.addColorStop(1, '#334155');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const points = processingResult.points;
    const spread = 50; // Increase spread to make points more visible

    // Project all points and sort by depth
    const projectedPoints = points.map(point => {
      const projected = project3D(
        point.position[0] * spread,
        point.position[1] * spread,
        point.position[2] * spread,
        canvas
      );
      return { ...point, ...projected };
    }).sort((a, b) => b.depth - a.depth);

    // Draw simplified cluster connections (only nearby points)
    if (processingResult.clusters) {
      processingResult.clusters.forEach(cluster => {
        const clusterPoints = projectedPoints.filter(p => p.cluster === cluster.id);
        
        if (clusterPoints.length > 1) {
          ctx.strokeStyle = cluster.color + '30';
          ctx.lineWidth = 0.5;
          
          // Only connect nearest neighbors to reduce visual clutter
          clusterPoints.forEach((point, i) => {
            const nearbyPoints = clusterPoints
              .filter((_, j) => j !== i)
              .map(other => ({
                point: other,
                distance: Math.sqrt(
                  Math.pow(point.position[0] - other.position[0], 2) +
                  Math.pow(point.position[1] - other.position[1], 2) +
                  Math.pow(point.position[2] - other.position[2], 2)
                )
              }))
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 2); // Only connect to 2 nearest neighbors
            
            nearbyPoints.forEach(({ point: nearbyPoint, distance }) => {
              if (distance < 1.5) {
                ctx.beginPath();
                ctx.moveTo(point.x, point.y);
                ctx.lineTo(nearbyPoint.x, nearbyPoint.y);
                ctx.stroke();
              }
            });
          });
        }
      });
    }

    // Draw points
    projectedPoints.forEach(point => {
      const isAnomaly = processingResult.anomalies?.includes(point.id);
      const isSelected = selectedPoint === point.id;
      
      if (isAnomaly) {
        const glowGradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, point.size * 2
        );
        glowGradient.addColorStop(0, '#ff0000aa');
        glowGradient.addColorStop(1, '#ff000000');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Selection highlight
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Main point
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner highlight
      ctx.fillStyle = '#ffffff60';
      ctx.beginPath();
      ctx.arc(point.x - point.size * 0.3, point.y - point.size * 0.3, point.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Point border for better visibility
      ctx.strokeStyle = '#000000aa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      ctx.stroke();
    });
  }, [processingResult, project3D]);

  // Animation loop with stable rotation
  useEffect(() => {
    const animate = () => {
      if (autoRotate) {
        rotationRef.current.y += 0.01;
      }
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoRotate, draw]);

  // Resize canvas
  useEffect(() => {
    const resizeCanvas = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
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

  // Mouse interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !processingResult?.points) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is on a point
    let clickedPoint = null;
    const points = processingResult.points.map(point => {
      const projected = project3D(
        point.position[0] * 50,
        point.position[1] * 50,
        point.position[2] * 50,
        canvas
      );
      return { ...point, ...projected };
    });

    for (const point of points) {
      const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
      if (distance <= point.size + 2) {
        clickedPoint = point;
        break;
      }
    }

    if (clickedPoint) {
      setSelectedPoint(selectedPoint === clickedPoint.id ? null : clickedPoint.id);
    } else {
      setIsDragging(true);
      setAutoRotate(false);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    
    rotationRef.current.x += deltaY * 0.01;
    rotationRef.current.y += deltaX * 0.01;
    
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.5, Math.min(3, prev + (e.deltaY > 0 ? -0.1 : 0.1))));
  };

  if (!processingResult?.points || processingResult.points.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        <div className="text-center max-w-md">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 180, 360] 
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="text-6xl mb-6 text-cyan-400"
          >
            ✨
          </motion.div>
          <h3 className="text-2xl font-semibold mb-4 text-white">
            Univers 3D en attente
          </h3>
          <p className="text-gray-300 leading-relaxed">
            Uploadez et analysez un dataset pour découvrir votre univers de données en 3D
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <canvas
        ref={canvasRef}
        className={`canvas-3d w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      <motion.div 
        className="absolute top-4 right-4 bg-black/60 backdrop-blur-md rounded-lg p-4 border border-white/10"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-sm text-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Points:</span>
            <span className="text-cyan-400 font-semibold">{processingResult.points.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Clusters:</span>
            <span className="text-green-400 font-semibold">{processingResult.clusters?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Anomalies:</span>
            <span className="text-red-400 font-semibold">{processingResult.anomalies?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Zoom:</span>
            <span className="text-blue-400 font-semibold">{(zoom * 100).toFixed(0)}%</span>
          </div>
        </div>
        
        <motion.button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`mt-3 w-full px-3 py-2 rounded-md text-xs font-medium transition-all ${
            autoRotate 
              ? 'bg-cyan-500 text-white' 
              : 'bg-gray-600 text-gray-300'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {autoRotate ? 'Rotation AUTO' : 'Rotation MANUELLE'}
        </motion.button>
      </motion.div>
      
      {/* Point Information Panel */}
      {selectedPoint && (() => {
        const point = processingResult.points.find(p => p.id === selectedPoint);
        return point ? (
          <motion.div 
            className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-cyan-400/30 max-w-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-white">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-cyan-400">Point sélectionné</h4>
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">ID:</span>
                  <span className="text-white font-mono">{point.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Cluster:</span>
                  <span className="text-green-400 font-semibold">{point.cluster}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Position:</span>
                  <span className="text-blue-400 font-mono text-xs">
                    [{point.position[0].toFixed(1)}, {point.position[1].toFixed(1)}, {point.position[2].toFixed(1)}]
                  </span>
                </div>
                {processingResult.anomalies?.includes(point.id) && (
                  <div className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs border border-red-500/30">
                    🚨 Anomalie détectée
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-3 border-t border-white/10">
                <h5 className="text-xs font-semibold text-gray-400 mb-2">DONNÉES ORIGINALES</h5>
                <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                  {Object.entries(point.originalData || {}).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-400 truncate">{key}:</span>
                      <span className="text-white ml-2 truncate">{String(value)}</span>
                    </div>
                  ))}
                  {Object.keys(point.originalData || {}).length > 6 && (
                    <div className="text-gray-500 text-center">... et {Object.keys(point.originalData || {}).length - 6} autres</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null;
      })()}

      <motion.div 
        className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="text-xs text-gray-300 space-y-1">
          <div>🖱️ Glisser pour tourner</div>
          <div>🔄 Molette pour zoomer</div>
          <div>👆 Cliquer sur les points</div>
          <div>✨ Interface optimisée iPhone</div>
        </div>
      </motion.div>
    </div>
  );
}