import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";

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

interface Improved3DSceneProps {
  processingResult?: ProcessingResult;
}

export default function Improved3DScene({ processingResult }: Improved3DSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameRef = useRef<number>();
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup with clean, simple aesthetic
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510); // Deep space blue
    sceneRef.current = scene;

    // Camera with optimal viewing angle
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 0, 50);
    cameraRef.current = camera;

    // Renderer with high quality and smooth appearance
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Ambient lighting for soft illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // Directional light for depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Subtle background stars
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 200;
    const starPositions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 200;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 0.5,
      transparent: true,
      opacity: 0.3
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      
      if (autoRotate && sceneRef.current) {
        sceneRef.current.rotation.y += 0.005;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);

    // Mouse controls for interaction
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseDown = (event: MouseEvent) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
      setAutoRotate(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseDown || !scene) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      
      scene.rotation.y += deltaX * 0.01;
      scene.rotation.x += deltaY * 0.01;
      
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const handleMouseUp = () => {
      mouseDown = false;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!camera) return;
      camera.position.z += event.deltaY * 0.1;
      camera.position.z = Math.max(10, Math.min(200, camera.position.z));
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      
      window.removeEventListener('resize', handleResize);
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, [autoRotate]);

  // Render data points when available
  useEffect(() => {
    if (!sceneRef.current || !processingResult?.points) return;

    // Clear existing data objects
    const objectsToRemove = sceneRef.current.children.filter(child => 
      child.userData.isDataPoint || child.userData.isClusterLine
    );
    objectsToRemove.forEach(obj => sceneRef.current!.remove(obj));

    const points = processingResult.points;
    const spread = 30; // Spread factor for better visibility

    // Create clean, simple point geometries
    points.forEach((point) => {
      const geometry = new THREE.SphereGeometry(0.8, 16, 16);
      const material = new THREE.MeshPhongMaterial({ 
        color: point.color,
        transparent: true,
        opacity: 0.9,
        shininess: 30
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(
        point.position[0] * spread,
        point.position[1] * spread,
        point.position[2] * spread
      );
      
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      sphere.userData = { 
        isDataPoint: true, 
        pointData: point 
      };
      
      sceneRef.current!.add(sphere);
    });

    // Draw simple, clean connections between cluster points
    if (processingResult.clusters) {
      processingResult.clusters.forEach((cluster) => {
        const clusterPoints = points.filter(p => p.cluster === cluster.id);
        
        if (clusterPoints.length > 1) {
          const lineGeometry = new THREE.BufferGeometry();
          const linePositions: number[] = [];
          
          // Create simple connecting lines between nearby points
          for (let i = 0; i < clusterPoints.length; i++) {
            for (let j = i + 1; j < clusterPoints.length; j++) {
              const pointA = clusterPoints[i];
              const pointB = clusterPoints[j];
              
              // Only connect close points to avoid visual clutter
              const distance = Math.sqrt(
                Math.pow(pointA.position[0] - pointB.position[0], 2) +
                Math.pow(pointA.position[1] - pointB.position[1], 2) +
                Math.pow(pointA.position[2] - pointB.position[2], 2)
              );
              
              if (distance < 2) { // Threshold for clean appearance
                linePositions.push(
                  pointA.position[0] * spread,
                  pointA.position[1] * spread,
                  pointA.position[2] * spread,
                  pointB.position[0] * spread,
                  pointB.position[1] * spread,
                  pointB.position[2] * spread
                );
              }
            }
          }
          
          if (linePositions.length > 0) {
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
            const lineMaterial = new THREE.LineBasicMaterial({ 
              color: cluster.color,
              transparent: true,
              opacity: 0.2,
              linewidth: 1
            });
            const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
            lines.userData = { isClusterLine: true };
            sceneRef.current!.add(lines);
          }
        }
      });
    }
  }, [processingResult]);

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
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Clean, minimal stats overlay */}
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
      
      {/* Simple, elegant controls help */}
      <motion.div 
        className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="text-xs text-gray-300 space-y-1">
          <div>🖱️ Glisser pour tourner</div>
          <div>🔄 Molette pour zoomer</div>
          <div>✨ Clic pour explorer</div>
        </div>
      </motion.div>
    </div>
  );
}