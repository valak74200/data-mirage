import { useRef, useMemo } from "react";
import { motion } from "framer-motion";
import GlassPanel from "@/components/ui/glass-panel";
import { useVisualizationStore } from "@/stores/visualization-store";

export default function Minimap() {
  const { processingResult } = useVisualizationStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const points = useMemo(() => {
    if (!processingResult?.points) return [];
    return processingResult.points.map(point => ({
      x: (point.position[0] + 100) / 200 * 128, // Normalize to canvas size
      y: (point.position[2] + 100) / 200 * 128,
      color: point.color,
      isAnomaly: point.isAnomaly,
    }));
  }, [processingResult]);

  // Draw minimap
  useMemo(() => {
    if (!canvasRef.current || points.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 128, 128);

    // Draw points
    points.forEach(point => {
      ctx.fillStyle = point.color;
      ctx.globalAlpha = point.isAnomaly ? 1 : 0.7;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.isAnomaly ? 2 : 1, 0, Math.PI * 2);
      ctx.fill();
      
      if (point.isAnomaly) {
        ctx.strokeStyle = point.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1;
  }, [points]);

  if (!processingResult) return null;

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute bottom-4 right-4 z-20"
    >
      <GlassPanel className="p-3">
        <div className="text-xs text-gray-400 mb-2">MINIMAP</div>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={128}
            height={128}
            className="w-32 h-32 bg-void rounded border border-gray-600"
          />
          {/* View indicator */}
          <div className="absolute top-8 left-8 w-4 h-4 border border-cyan-400 rounded opacity-50 pointer-events-none" />
        </div>
      </GlassPanel>
    </motion.div>
  );
}
