/**
 * useSelection Hook - Gestion de la sélection de points et clusters
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { Point3D, Cluster, Camera, ViewportDimensions, SelectionState } from '../types';
import { GeometryUtils } from '../utils/geometry';

interface UseSelectionOptions {
  onPointSelect?: (point: Point3D | null) => void;
  onClusterSelect?: (cluster: Cluster | null) => void;
  onHover?: (point: Point3D | null) => void;
  selectionRadius?: number;
  multiSelect?: boolean;
}

interface UseSelectionReturn {
  selectionState: SelectionState;
  selectedPoint: Point3D | null;
  hoveredPoint: Point3D | null;
  selectedCluster: Cluster | null;
  multiSelectedPoints: Point3D[];
  handleCanvasClick: (e: React.MouseEvent, points: Point3D[], clusters: Cluster[], camera: Camera, viewport: ViewportDimensions) => void;
  handleCanvasMouseMove: (e: React.MouseEvent, points: Point3D[], camera: Camera, viewport: ViewportDimensions) => void;
  selectPoint: (point: Point3D | null) => void;
  selectCluster: (cluster: Cluster | null) => void;
  clearSelection: () => void;
  isPointSelected: (pointId: string) => boolean;
  isClusterSelected: (clusterId: string | number) => boolean;
  getSelectionInfo: () => { selectedCount: number; clustersRepresented: number };
}

export function useSelection({
  onPointSelect,
  onClusterSelect,
  onHover,
  selectionRadius = 10,
  multiSelect = false
}: UseSelectionOptions = {}): UseSelectionReturn {
  
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectedPointId: null,
    hoveredPointId: null,
    selectedClusterId: null
  });

  const [multiSelectedPoints, setMultiSelectedPoints] = useState<Point3D[]>([]);
  const pointsRef = useRef<Point3D[]>([]);
  const clustersRef = useRef<Cluster[]>([]);

  // Find currently selected point and cluster
  const selectedPoint = pointsRef.current.find(p => p.id === selectionState.selectedPointId) || null;
  const hoveredPoint = pointsRef.current.find(p => p.id === selectionState.hoveredPointId) || null;
  const selectedCluster = clustersRef.current.find(c => c.id === selectionState.selectedClusterId) || null;

  // Project 3D point to screen coordinates
  const projectPointToScreen = useCallback((
    point: Point3D, 
    camera: Camera, 
    viewport: ViewportDimensions
  ): { x: number; y: number; z: number } => {
    const { position, rotation, zoom } = camera;
    const { width, height } = viewport;

    // Translate to camera space
    let x = point.position[0] - position[0];
    let y = point.position[1] - position[1];
    let z = point.position[2] - position[2];

    // Apply camera rotation
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);

    // Rotate around Y then X
    const tempX = x * cosY - z * sinY;
    const tempZ = x * sinY + z * cosY;
    x = tempX;
    z = tempZ;

    const tempY = y * cosX - z * sinX;
    z = y * sinX + z * cosX;
    y = tempY;

    // Perspective projection
    const focalLength = 400;
    const perspective = focalLength / (focalLength + z);
    
    const screenX = (x * perspective * zoom) + width / 2;
    const screenY = (-y * perspective * zoom) + height / 2;

    return { x: screenX, y: screenY, z };
  }, []);

  // Find point at screen coordinates
  const findPointAtCoords = useCallback((
    screenX: number,
    screenY: number,
    points: Point3D[],
    camera: Camera,
    viewport: ViewportDimensions
  ): Point3D | null => {
    let closestPoint: Point3D | null = null;
    let closestDistance = selectionRadius;
    let closestDepth = Infinity;

    for (const point of points) {
      const projected = projectPointToScreen(point, camera, viewport);
      
      // Check if point is in front of camera
      if (projected.z > 0) continue;

      const distance = Math.sqrt(
        Math.pow(screenX - projected.x, 2) + 
        Math.pow(screenY - projected.y, 2)
      );

      // Point size affects selection area
      const pointRadius = Math.max(4, (point.size || 4) * camera.zoom);
      const effectiveRadius = selectionRadius + pointRadius;

      if (distance <= effectiveRadius) {
        // Prefer closer points (smaller z value since we're looking down negative z)
        if (projected.z < closestDepth) {
          closestPoint = point;
          closestDistance = distance;
          closestDepth = projected.z;
        }
      }
    }

    return closestPoint;
  }, [selectionRadius, projectPointToScreen]);

  // Handle canvas click for selection
  const handleCanvasClick = useCallback((
    e: React.MouseEvent,
    points: Point3D[],
    clusters: Cluster[],
    camera: Camera,
    viewport: ViewportDimensions
  ) => {
    // Update refs
    pointsRef.current = points;
    clustersRef.current = clusters;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedPoint = findPointAtCoords(x, y, points, camera, viewport);
    
    if (clickedPoint) {
      if (!multiSelect) {
        // Single selection mode
        const newSelectedId = selectionState.selectedPointId === clickedPoint.id ? null : clickedPoint.id;
        setSelectionState(prev => ({
          ...prev,
          selectedPointId: newSelectedId,
          selectedClusterId: newSelectedId ? clickedPoint.cluster || null : null
        }));

        if (onPointSelect) {
          onPointSelect(newSelectedId ? clickedPoint : null);
        }

        if (onClusterSelect && (newSelectedId ? clickedPoint.cluster : null)) {
          const cluster = clusters.find(c => c.id === clickedPoint.cluster);
          onClusterSelect(cluster || null);
        }
      } else {
        // Multi-selection mode
        setMultiSelectedPoints(prev => {
          const isAlreadySelected = prev.some(p => p.id === clickedPoint.id);
          let newSelection: Point3D[];
          
          if (isAlreadySelected) {
            newSelection = prev.filter(p => p.id !== clickedPoint.id);
          } else {
            newSelection = [...prev, clickedPoint];
          }

          // Update primary selection to last clicked
          setSelectionState(prevState => ({
            ...prevState,
            selectedPointId: newSelection.length > 0 ? clickedPoint.id : null,
            selectedClusterId: newSelection.length > 0 ? clickedPoint.cluster || null : null
          }));

          return newSelection;
        });
      }
    } else {
      // Clicked on empty space - clear selection
      clearSelection();
    }
  }, [selectionState.selectedPointId, multiSelect, onPointSelect, onClusterSelect, findPointAtCoords]);

  // Handle mouse move for hover effects
  const handleCanvasMouseMove = useCallback((
    e: React.MouseEvent,
    points: Point3D[],
    camera: Camera,
    viewport: ViewportDimensions
  ) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hoveredPoint = findPointAtCoords(x, y, points, camera, viewport);
    const newHoveredId = hoveredPoint?.id || null;

    if (newHoveredId !== selectionState.hoveredPointId) {
      setSelectionState(prev => ({ ...prev, hoveredPointId: newHoveredId }));
      
      if (onHover) {
        onHover(hoveredPoint);
      }
    }
  }, [selectionState.hoveredPointId, onHover, findPointAtCoords]);

  // Programmatic selection functions
  const selectPoint = useCallback((point: Point3D | null) => {
    setSelectionState(prev => ({
      ...prev,
      selectedPointId: point?.id || null,
      selectedClusterId: point?.cluster || null
    }));

    if (!multiSelect) {
      setMultiSelectedPoints(point ? [point] : []);
    }

    if (onPointSelect) {
      onPointSelect(point);
    }
  }, [multiSelect, onPointSelect]);

  const selectCluster = useCallback((cluster: Cluster | null) => {
    setSelectionState(prev => ({
      ...prev,
      selectedClusterId: cluster?.id || null,
      selectedPointId: null // Clear point selection when selecting cluster
    }));

    if (onClusterSelect) {
      onClusterSelect(cluster);
    }

    // In multi-select mode, select all points in cluster
    if (multiSelect && cluster) {
      const clusterPoints = pointsRef.current.filter(p => p.cluster === cluster.id);
      setMultiSelectedPoints(clusterPoints);
    }
  }, [multiSelect, onClusterSelect]);

  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedPointId: null,
      hoveredPointId: null,
      selectedClusterId: null
    });
    
    setMultiSelectedPoints([]);

    if (onPointSelect) {
      onPointSelect(null);
    }
    
    if (onClusterSelect) {
      onClusterSelect(null);
    }
  }, [onPointSelect, onClusterSelect]);

  // Helper functions
  const isPointSelected = useCallback((pointId: string): boolean => {
    if (multiSelect) {
      return multiSelectedPoints.some(p => p.id === pointId);
    }
    return selectionState.selectedPointId === pointId;
  }, [multiSelect, multiSelectedPoints, selectionState.selectedPointId]);

  const isClusterSelected = useCallback((clusterId: string | number): boolean => {
    return selectionState.selectedClusterId === clusterId;
  }, [selectionState.selectedClusterId]);

  const getSelectionInfo = useCallback(() => {
    const selectedCount = multiSelect ? multiSelectedPoints.length : (selectedPoint ? 1 : 0);
    const clustersRepresented = new Set(
      (multiSelect ? multiSelectedPoints : (selectedPoint ? [selectedPoint] : []))
        .map(p => p.cluster)
        .filter(c => c !== undefined)
    ).size;

    return { selectedCount, clustersRepresented };
  }, [multiSelect, multiSelectedPoints, selectedPoint]);

  // Keyboard shortcuts for selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'escape':
          clearSelection();
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            // Select all points
            e.preventDefault();
            if (multiSelect) {
              setMultiSelectedPoints(pointsRef.current);
            }
          }
          break;
        case 'delete':
        case 'backspace':
          // Could trigger point deletion if implemented
          if (selectedPoint && e.shiftKey) {
            // Confirm deletion logic would go here
            console.log('Delete point:', selectedPoint.id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, multiSelect, selectedPoint]);

  // Auto-select cluster when point is selected
  useEffect(() => {
    if (selectedPoint && selectedPoint.cluster && !selectionState.selectedClusterId) {
      setSelectionState(prev => ({
        ...prev,
        selectedClusterId: selectedPoint.cluster || null
      }));
    }
  }, [selectedPoint, selectionState.selectedClusterId]);

  return {
    selectionState,
    selectedPoint,
    hoveredPoint,
    selectedCluster,
    multiSelectedPoints,
    handleCanvasClick,
    handleCanvasMouseMove,
    selectPoint,
    selectCluster,
    clearSelection,
    isPointSelected,
    isClusterSelected,
    getSelectionInfo
  };
}