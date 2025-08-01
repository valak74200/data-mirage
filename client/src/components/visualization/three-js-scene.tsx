import React, { useRef, useEffect, useState } from 'react';
import { useVisualizationStore } from '@/stores/visualization-store';
import * as THREE from 'three';

export default function ThreeJSScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameId = useRef<number>();
  const pointsRef = useRef<THREE.Points>();
  const controlsRef = useRef<any>();
  
  const { processingResult, setHoveredPoint } = useVisualizationStore();
  const [autoRotate, setAutoRotate] = useState(true);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Orbit controls (manual implementation)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      setAutoRotate(false);
      previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;

      const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
      };

      const deltaRotationQuaternion = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(
          deltaMove.y * 0.01,
          deltaMove.x * 0.01,
          0,
          'XYZ'
        ));

      camera.quaternion.multiplyQuaternions(deltaRotationQuaternion, camera.quaternion);
      previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
      setTimeout(() => setAutoRotate(true), 2000);
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);

    // Animation loop
    const animate = () => {
      if (autoRotate && cameraRef.current) {
        const radius = cameraRef.current.position.length();
        const time = Date.now() * 0.001;
        cameraRef.current.position.x = Math.cos(time * 0.3) * radius;
        cameraRef.current.position.z = Math.sin(time * 0.3) * radius;
        cameraRef.current.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
      frameId.current = requestAnimationFrame(animate);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [autoRotate]);

  // Update points when data changes
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !processingResult?.points) return;

    // Remove existing points
    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
    }

    const points = processingResult.points;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const sizes = new Float32Array(points.length);

    points.forEach((point, i) => {
      const spread = 30;
      positions[i * 3] = point.position[0] * spread;
      positions[i * 3 + 1] = point.position[1] * spread;
      positions[i * 3 + 2] = point.position[2] * spread;

      // Parse color
      const color = new THREE.Color(point.color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.max(1, point.size * 5);
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Point material
    const material = new THREE.PointsMaterial({
      size: 5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });

    // Create points mesh
    const pointsMesh = new THREE.Points(geometry, material);
    pointsRef.current = pointsMesh;
    sceneRef.current.add(pointsMesh);

    // Add connections between cluster points
    const clusters: { [key: string]: typeof points } = {};
    points.forEach(point => {
      const clusterId = String(point.cluster || 'none');
      if (!clusters[clusterId]) clusters[clusterId] = [];
      clusters[clusterId].push(point);
    });

    Object.entries(clusters).forEach(([clusterId, clusterPoints]) => {
      if (clusterId === 'none' || clusterPoints.length < 2) return;

      const lineGeometry = new THREE.BufferGeometry();
      const linePositions: number[] = [];

      for (let i = 0; i < clusterPoints.length; i++) {
        for (let j = i + 1; j < clusterPoints.length; j++) {
          const pointA = clusterPoints[i];
          const pointB = clusterPoints[j];

          const distance = Math.sqrt(
            Math.pow(pointA.position[0] - pointB.position[0], 2) +
            Math.pow(pointA.position[1] - pointB.position[1], 2) +
            Math.pow(pointA.position[2] - pointB.position[2], 2)
          );

          if (distance < 0.8) {
            const spread = 30;
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
          color: clusterPoints[0].color,
          transparent: true,
          opacity: 0.3
        });
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        if (sceneRef.current) {
          sceneRef.current.add(lines);
        }
      }
    });

  }, [processingResult]);

  if (!processingResult?.points || processingResult.points.length === 0) {
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
    <div className="flex-1 relative">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3">
        <div className="text-sm text-white space-y-1">
          <div>Points: <span className="text-blue-400">{processingResult.points.length}</span></div>
          <div>Clusters: <span className="text-green-400">{processingResult.clusters?.length || 0}</span></div>
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
          <div>📱 Touch: Pincer/Glisser</div>
        </div>
      </div>
    </div>
  );
}