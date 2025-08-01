import { useState } from "react";
import { motion } from "framer-motion";
import ParticleBackground from "@/components/visualization/particle-background";
import ControlsPanel from "@/components/visualization/controls-panel";
import ThreeScene from "@/components/visualization/three-scene";
import LegendPanel from "@/components/visualization/legend-panel";
import InfoPanel from "@/components/visualization/info-panel";
import Minimap from "@/components/visualization/minimap";
import { useVisualizationStore } from "@/stores/visualization-store";

export default function Home() {
  const visualizationStore = useVisualizationStore();
  const { currentDataset, processingResult, hoveredPoint, resetCamera } = visualizationStore;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative h-screen flex bg-space text-white overflow-hidden">
      <ParticleBackground />
      
      {/* Side Panel */}
      <motion.div
        initial={{ x: -320 }}
        animate={{ x: 0 }}
        className="w-80 glass-panel border-r border-cyan-500/30 p-6 overflow-y-auto z-10"
      >
        <ControlsPanel />
      </motion.div>

      {/* Main Visualization Area */}
      <div className="flex-1 relative">
        {/* Top Control Bar */}
        <motion.div
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          className="absolute top-4 left-4 right-4 flex justify-between items-center z-20"
        >
          {/* View Controls */}
          <div className="flex space-x-2">
            <button 
              className="glass-panel neon-border rounded-lg p-2 hover:bg-cyan-500/20 transition-all duration-300"
              onClick={resetCamera}
            >
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button 
              className="glass-panel neon-border rounded-lg p-2 hover:bg-green-500/20 transition-all duration-300"
              onClick={toggleFullscreen}
            >
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </button>
          </div>

          {/* Processing Status */}
          <div className="glass-panel rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${processingResult ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-mono text-green-400">
                {processingResult ? 'READY' : 'WAITING'}
              </span>
            </div>
          </div>

          {/* Export Controls */}
          <div className="flex space-x-2">
            <button className="glass-panel neon-border rounded-lg px-4 py-2 hover:bg-violet-500/20 transition-all duration-300 text-sm font-mono">
              EXPORT
            </button>
            <button className="glass-panel neon-border rounded-lg px-4 py-2 hover:bg-cyan-500/20 transition-all duration-300 text-sm font-mono">
              BOOKMARK
            </button>
          </div>
        </motion.div>

        {/* 3D Visualization */}
        <ThreeScene />

        {/* Info Panel */}
        {hoveredPoint && <InfoPanel point={hoveredPoint} />}

        {/* Legend Panel */}
        {processingResult && <LegendPanel clusters={processingResult.clusters} />}

        {/* Minimap */}
        <Minimap />
      </div>
    </div>
  );
}
