import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useVisualizationStore } from '@/stores/visualization-store';

// Point component for individual data points
function DataPoint({ position, color, size, isAnomaly, data, onHover }: {
  position: [number, number, number];
  color: string;
  size: number;
  isAnomaly: boolean;
  data: any;
  onHover: (data: any | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current && isAnomaly) {
      // Gentle pulsing animation for anomalies
      meshRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.2);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={() => onHover(data)}
      onPointerOut={() => onHover(null)}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial 
        color={color} 
        emissive={isAnomaly ? color : '#000000'}
        emissiveIntensity={isAnomaly ? 0.3 : 0}
        transparent
        opacity={0.8}
      />
      {isAnomaly && (
        <mesh>
          <sphereGeometry args={[size * 1.5, 16, 16]} />
          <meshBasicMaterial 
            color={color}
            transparent
            opacity={0.2}
            wireframe
          />
        </mesh>
      )}
    </mesh>
  );
}

// Cluster connections component
function ClusterConnections({ clusters }: { clusters: { [key: string]: any[] } }) {
  const connections = useMemo(() => {
    const lines: JSX.Element[] = [];
    
    Object.entries(clusters).forEach(([clusterId, points]) => {
      if (clusterId === 'none' || points.length < 2) return;
      
      const clusterColor = points[0]?.color || '#ffffff';
      
      // Create connections between nearby points in the same cluster
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const pointA = points[i];
          const pointB = points[j];
          
          // Calculate 3D distance
          const distance = Math.sqrt(
            Math.pow(pointA.position[0] - pointB.position[0], 2) +
            Math.pow(pointA.position[1] - pointB.position[1], 2) +
            Math.pow(pointA.position[2] - pointB.position[2], 2)
          );
          
          // Only connect nearby points
          if (distance < 15) {
            lines.push(
              <Line
                key={`${clusterId}-${i}-${j}`}
                points={[pointA.position, pointB.position]}
                color={clusterColor}
                opacity={0.3}
                lineWidth={1}
              />
            );
          }
        }
      }
    });
    
    return lines;
  }, [clusters]);

  return <>{connections}</>;
}

// Grid background component
function GridBackground() {
  return (
    <>
      <gridHelper args={[100, 20, '#00ffff', '#004444']} />
      <axesHelper args={[20]} />
    </>
  );
}

// Lighting setup
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <directionalLight position={[0, 10, 5]} intensity={0.8} />
    </>
  );
}

// Main scene component
function Scene() {
  const { processingResult, setHoveredPoint, cameraReset, setCameraReset } = useVisualizationStore();
  const { camera } = useThree();

  // Reset camera when requested
  useEffect(() => {
    if (cameraReset) {
      camera.position.set(25, 25, 25);
      camera.lookAt(0, 0, 0);
      setCameraReset(false);
    }
  }, [cameraReset, camera, setCameraReset]);

  // Prepare data points with better spacing
  const { points, clusters } = useMemo(() => {
    if (!processingResult?.points) return { points: [], clusters: {} };
    
    const spread = 40; // Optimal spacing for Three.js scene
    const clusters: { [key: string]: any[] } = {};
    
    const points = processingResult.points.map(point => {
      const position: [number, number, number] = [
        point.position[0] * spread,
        point.position[1] * spread,
        point.position[2] * spread
      ];
      
      const clusterId = point.clusterId || 'none';
      if (!clusters[clusterId]) clusters[clusterId] = [];
      
      const pointData = {
        position,
        color: point.color,
        size: Math.max(0.3, point.size * 2),
        isAnomaly: point.isAnomaly || false,
        data: point
      };
      
      clusters[clusterId].push(pointData);
      return pointData;
    });
    
    return { points, clusters };
  }, [processingResult]);

  return (
    <>
      <Lighting />
      <GridBackground />
      <ClusterConnections clusters={clusters} />
      
      {points.map((point, index) => (
        <DataPoint
          key={index}
          position={point.position}
          color={point.color}
          size={point.size}
          isAnomaly={point.isAnomaly}
          data={point.data}
          onHover={setHoveredPoint}
        />
      ))}
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxDistance={200}
        minDistance={10}
      />
    </>
  );
}

// Main component
export default function ThreeSceneNew() {
  const { processingResult } = useVisualizationStore();

  if (!processingResult?.points) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <div className="text-4xl mb-4">🌌</div>
          <div>Aucune visualisation disponible</div>
          <div className="text-sm mt-2">Uploadez un dataset et cliquez sur "GENERATE 3D VIEW"</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <Canvas
        camera={{ position: [25, 25, 25], fov: 75 }}
        style={{ background: 'radial-gradient(circle, #0a0a0f 0%, #000000 100%)' }}
      >
        <Scene />
      </Canvas>
      
      {/* Overlay info */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm border border-cyan-500/20 rounded-lg p-3">
        <div className="text-xs text-gray-400 space-y-1">
          <div>Points: <span className="text-cyan-400">{processingResult.points.length}</span></div>
          <div>Clusters: <span className="text-green-400">{processingResult.summary?.numClusters || 0}</span></div>
          <div>Anomalies: <span className="text-red-400">{processingResult.points.filter(p => p.isAnomaly).length}</span></div>
        </div>
      </div>
      
      {/* Controls help */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm border border-cyan-500/20 rounded-lg p-3">
        <div className="text-xs text-gray-400 space-y-1">
          <div>🖱️ Clic gauche: Rotation</div>
          <div>🖱️ Clic droit: Déplacement</div>
          <div>⚪ Molette: Zoom</div>
          <div>📱 Touch: Glisser/Pincer</div>
        </div>
      </div>
    </div>
  );
}