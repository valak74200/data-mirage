import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVisualizationStore } from "@/stores/visualization-store";
import { useIsMobile } from "@/hooks/use-mobile";
import ThreeJSScene from "@/components/visualization/three-js-scene";
import Mobile3DScene from "@/components/visualization/mobile-3d-scene";
import SimpleControls from "@/components/visualization/simple-controls";

export default function HomeNew() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentDataset, processingResult, resetCamera } = useVisualizationStore();
  const isMobile = useIsMobile();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {(!isMobile || sidebarOpen) && (
          <>
            {isMobile && sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <motion.div
              initial={{ x: isMobile ? -400 : 0 }}
              animate={{ x: 0 }}
              exit={{ x: -400 }}
              className={`${
                isMobile 
                  ? 'fixed left-0 top-0 h-full z-50' 
                  : 'relative'
              } w-80 bg-gray-900/95 backdrop-blur-xl border-r border-gray-700/50 flex flex-col`}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-700/50">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-white">Data Mirage</h1>
                  {isMobile && (
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-2">Visualisation 3D intelligente de données</p>
              </div>

              {/* Controls */}
              <div className="flex-1 overflow-y-auto p-6">
                <SimpleControls />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            {/* Left - Menu & Controls */}
            <div className="flex items-center space-x-4">
              {isMobile && (
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              
              <button
                onClick={resetCamera}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset View</span>
              </button>
            </div>

            {/* Center - Status */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  processingResult ? 'bg-green-500' : currentDataset ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-300">
                  {processingResult ? 'Visualisation prête' : currentDataset ? 'Dataset chargé' : 'En attente de données'}
                </span>
              </div>
              
              {processingResult && (
                <div className="text-xs text-gray-400 space-x-4">
                  <span>{processingResult.points?.length || 0} points</span>
                  <span>{processingResult.clusters?.length || 0} clusters</span>
                </div>
              )}
            </div>

            {/* Right - Actions */}
            <div className="flex items-center space-x-2">
              {!isMobile && (
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3D Visualization Area */}
        <div className="flex-1 relative">
          {isMobile ? <Mobile3DScene /> : <ThreeJSScene />}
        </div>
      </div>
    </div>
  );
}