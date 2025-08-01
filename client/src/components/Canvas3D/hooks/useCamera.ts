/**
 * useCamera Hook - Gestion de la caméra 3D avec contrôles fluides
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { Camera, InteractionConfig, AnimationState } from '../types';
import { GeometryUtils } from '../utils/geometry';

interface UseCameraOptions {
  initialCamera?: Partial<Camera>;
  interactions: InteractionConfig;
  onCameraChange?: (camera: Camera) => void;
}

interface UseCameraReturn {
  camera: Camera;
  animationState: AnimationState;
  updateCamera: (updates: Partial<Camera>) => void;
  resetCamera: () => void;
  setAutoRotate: (enabled: boolean) => void;
  setRotationSpeed: (speed: number) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

const DEFAULT_CAMERA: Camera = {
  position: [0, 0, 200],
  rotation: { x: 0.3, y: 0.3, z: 0 },
  zoom: 1,
  target: [0, 0, 0],
  fov: 75
};

const DEFAULT_ANIMATION: AnimationState = {
  autoRotate: true,
  rotationSpeed: 0.005,
  isAnimating: false,
  startTime: undefined
};

export function useCamera({
  initialCamera,
  interactions,
  onCameraChange
}: UseCameraOptions): UseCameraReturn {
  
  const [camera, setCamera] = useState<Camera>({
    ...DEFAULT_CAMERA,
    ...initialCamera
  });

  const [animationState, setAnimationState] = useState<AnimationState>(DEFAULT_ANIMATION);

  // Interaction state
  const isDraggingRef = useRef(false);
  const isZoomingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const autoRotatePausedRef = useRef(false);

  // Smoothing and damping
  const velocityRef = useRef({ x: 0, y: 0, zoom: 0 });
  const dampingFactor = 0.9;

  // Update camera and notify
  const updateCamera = useCallback((updates: Partial<Camera>) => {
    setCamera(prevCamera => {
      const newCamera = { ...prevCamera, ...updates };
      
      if (onCameraChange) {
        onCameraChange(newCamera);
      }
      
      return newCamera;
    });
  }, [onCameraChange]);

  // Reset camera to initial state
  const resetCamera = useCallback(() => {
    const initialCam = {
      ...DEFAULT_CAMERA,
      ...initialCamera
    };
    
    updateCamera(initialCam);
    setAnimationState(prev => ({ ...prev, autoRotate: true }));
    velocityRef.current = { x: 0, y: 0, zoom: 0 };
  }, [initialCamera, updateCamera]);

  // Auto-rotation controls
  const setAutoRotate = useCallback((enabled: boolean) => {
    setAnimationState(prev => ({ ...prev, autoRotate: enabled }));
  }, []);

  const setRotationSpeed = useCallback((speed: number) => {
    setAnimationState(prev => ({ ...prev, rotationSpeed: speed }));
  }, []);

  // Mouse interactions
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactions.rotation) return;

    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    
    // Pause auto-rotation when user interacts
    if (animationState.autoRotate) {
      autoRotatePausedRef.current = true;
      setAnimationState(prev => ({ ...prev, autoRotate: false }));
    }

    e.preventDefault();
  }, [interactions.rotation, animationState.autoRotate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !interactions.rotation) return;

    const deltaX = e.clientX - lastPointerRef.current.x;
    const deltaY = e.clientY - lastPointerRef.current.y;

    // Calculate rotation with sensitivity
    const sensitivity = 0.005;
    const rotationDeltaX = deltaY * sensitivity;
    const rotationDeltaY = deltaX * sensitivity;

    // Update velocity for smooth movement
    velocityRef.current.x = rotationDeltaX;
    velocityRef.current.y = rotationDeltaY;

    updateCamera({
      rotation: {
        x: camera.rotation.x + rotationDeltaX,
        y: camera.rotation.y + rotationDeltaY,
        z: camera.rotation.z || 0
      }
    });

    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, [interactions.rotation, camera.rotation, updateCamera]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    
    // Resume auto-rotation after a delay
    if (autoRotatePausedRef.current) {
      setTimeout(() => {
        if (!isDraggingRef.current) {
          setAnimationState(prev => ({ ...prev, autoRotate: true }));
          autoRotatePausedRef.current = false;
        }
      }, 2000);
    }
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactions.zoom) return;

    const zoomSensitivity = 0.1;
    const zoomDelta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
    
    const newZoom = Math.max(0.1, Math.min(5, camera.zoom + zoomDelta));
    
    updateCamera({ zoom: newZoom });
    
    e.preventDefault();
  }, [interactions.zoom, camera.zoom, updateCamera]);

  // Touch interactions
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!interactions.touchGestures) return;

    e.preventDefault();

    if (e.touches.length === 1) {
      // Single touch - rotation
      if (interactions.rotation) {
        const touch = e.touches[0];
        isDraggingRef.current = true;
        lastPointerRef.current = { x: touch.clientX, y: touch.clientY };
        
        if (animationState.autoRotate) {
          autoRotatePausedRef.current = true;
          setAnimationState(prev => ({ ...prev, autoRotate: false }));
        }
      }
    } else if (e.touches.length === 2) {
      // Two finger pinch - zoom
      if (interactions.zoom) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        lastTouchDistanceRef.current = distance;
        isZoomingRef.current = true;
        isDraggingRef.current = false;
      }
    }
  }, [interactions.touchGestures, interactions.rotation, interactions.zoom, animationState.autoRotate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!interactions.touchGestures) return;

    e.preventDefault();

    if (e.touches.length === 1 && isDraggingRef.current) {
      // Single touch rotation
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPointerRef.current.x;
      const deltaY = touch.clientY - lastPointerRef.current.y;

      const sensitivity = 0.008; // Slightly higher sensitivity for touch
      const rotationDeltaX = deltaY * sensitivity;
      const rotationDeltaY = deltaX * sensitivity;

      updateCamera({
        rotation: {
          x: camera.rotation.x + rotationDeltaX,
          y: camera.rotation.y + rotationDeltaY,
          z: camera.rotation.z || 0
        }
      });

      lastPointerRef.current = { x: touch.clientX, y: touch.clientY };
      
    } else if (e.touches.length === 2 && isZoomingRef.current) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const deltaDistance = distance - lastTouchDistanceRef.current;
      const zoomDelta = deltaDistance * 0.005;
      
      const newZoom = Math.max(0.1, Math.min(5, camera.zoom + zoomDelta));
      updateCamera({ zoom: newZoom });

      lastTouchDistanceRef.current = distance;
    }
  }, [interactions.touchGestures, camera.rotation, camera.zoom, updateCamera]);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    isZoomingRef.current = false;
    
    // Resume auto-rotation after touch ends
    if (autoRotatePausedRef.current) {
      setTimeout(() => {
        if (!isDraggingRef.current && !isZoomingRef.current) {
          setAnimationState(prev => ({ ...prev, autoRotate: true }));
          autoRotatePausedRef.current = false;
        }
      }, 3000);
    }
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!interactions.keyboardShortcuts) return;

    const rotationStep = 0.1;
    const zoomStep = 0.1;
    const positionStep = 10;

    switch (e.key.toLowerCase()) {
      case 'r':
        resetCamera();
        break;
      case ' ':
        setAutoRotate(!animationState.autoRotate);
        e.preventDefault();
        break;
      case 'arrowup':
        updateCamera({
          rotation: { ...camera.rotation, x: camera.rotation.x - rotationStep }
        });
        e.preventDefault();
        break;
      case 'arrowdown':
        updateCamera({
          rotation: { ...camera.rotation, x: camera.rotation.x + rotationStep }
        });
        e.preventDefault();
        break;
      case 'arrowleft':
        updateCamera({
          rotation: { ...camera.rotation, y: camera.rotation.y - rotationStep }
        });
        e.preventDefault();
        break;
      case 'arrowright':
        updateCamera({
          rotation: { ...camera.rotation, y: camera.rotation.y + rotationStep }
        });
        e.preventDefault();
        break;
      case '+':
      case '=':
        updateCamera({ zoom: Math.min(5, camera.zoom + zoomStep) });
        e.preventDefault();
        break;
      case '-':
        updateCamera({ zoom: Math.max(0.1, camera.zoom - zoomStep) });
        e.preventDefault();
        break;
    }
  }, [interactions.keyboardShortcuts, animationState.autoRotate, camera, updateCamera, resetCamera, setAutoRotate]);

  // Animation loop for auto-rotation and smooth damping
  useEffect(() => {
    const animate = () => {
      let needsUpdate = false;

      // Auto-rotation
      if (animationState.autoRotate && !isDraggingRef.current && !isZoomingRef.current) {
        updateCamera({
          rotation: {
            ...camera.rotation,
            y: camera.rotation.y + animationState.rotationSpeed
          }
        });
        needsUpdate = true;
      }

      // Apply velocity damping for smooth movement
      const velocity = velocityRef.current;
      if (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001) {
        velocity.x *= dampingFactor;
        velocity.y *= dampingFactor;
        
        if (!isDraggingRef.current) {
          updateCamera({
            rotation: {
              x: camera.rotation.x + velocity.x,
              y: camera.rotation.y + velocity.y,
              z: camera.rotation.z || 0
            }
          });
          needsUpdate = true;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animationState.autoRotate, animationState.rotationSpeed, camera.rotation, updateCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    camera,
    animationState,
    updateCamera,
    resetCamera,
    setAutoRotate,
    setRotationSpeed,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleKeyDown
  };
}