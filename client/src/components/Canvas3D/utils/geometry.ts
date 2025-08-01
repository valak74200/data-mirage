/**
 * Geometry utilities for 3D calculations
 */

import { Point3D, Camera } from '../types';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Matrix4 {
  elements: number[]; // 16 elements in column-major order
}

export class GeometryUtils {
  
  // Vector operations
  static vectorAdd(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static vectorSubtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static vectorMultiply(v: Vector3, scalar: number): Vector3 {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  }

  static vectorLength(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static vectorNormalize(v: Vector3): Vector3 {
    const length = this.vectorLength(v);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  }

  static vectorDot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static vectorCross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  // Distance calculations
  static distance3D(a: Point3D, b: Point3D): number {
    return Math.sqrt(
      Math.pow(a.position[0] - b.position[0], 2) +
      Math.pow(a.position[1] - b.position[1], 2) +
      Math.pow(a.position[2] - b.position[2], 2)
    );
  }

  static distanceToCamera(point: Point3D, camera: Camera): number {
    return Math.sqrt(
      Math.pow(point.position[0] - camera.position[0], 2) +
      Math.pow(point.position[1] - camera.position[1], 2) +
      Math.pow(point.position[2] - camera.position[2], 2)
    );
  }

  // Matrix operations
  static createIdentityMatrix(): Matrix4 {
    return {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    };
  }

  static createTranslationMatrix(x: number, y: number, z: number): Matrix4 {
    return {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
      ]
    };
  }

  static createRotationMatrixX(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return {
      elements: [
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
      ]
    };
  }

  static createRotationMatrixY(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return {
      elements: [
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
      ]
    };
  }

  static createRotationMatrixZ(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return {
      elements: [
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    };
  }

  static multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
    const result = this.createIdentityMatrix();
    const ae = a.elements;
    const be = b.elements;
    const re = result.elements;

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        re[i * 4 + j] = 
          ae[i * 4 + 0] * be[0 * 4 + j] +
          ae[i * 4 + 1] * be[1 * 4 + j] +
          ae[i * 4 + 2] * be[2 * 4 + j] +
          ae[i * 4 + 3] * be[3 * 4 + j];
      }
    }

    return result;
  }

  static transformPoint(point: Vector3, matrix: Matrix4): Vector3 {
    const e = matrix.elements;
    const x = point.x;
    const y = point.y;
    const z = point.z;

    return {
      x: e[0] * x + e[4] * y + e[8] * z + e[12],
      y: e[1] * x + e[5] * y + e[9] * z + e[13],
      z: e[2] * x + e[6] * y + e[10] * z + e[14]
    };
  }

  // Projection utilities
  static createPerspectiveMatrix(
    fov: number,
    aspect: number,
    near: number,
    far: number
  ): Matrix4 {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);

    return {
      elements: [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, near * far * rangeInv * 2, 0
      ]
    };
  }

  static createViewMatrix(camera: Camera): Matrix4 {
    const { position, rotation } = camera;
    
    // Create rotation matrices
    const rotX = this.createRotationMatrixX(rotation.x);
    const rotY = this.createRotationMatrixY(rotation.y);
    const rotZ = this.createRotationMatrixZ(rotation.z || 0);
    
    // Combine rotations
    let viewMatrix = this.multiplyMatrices(rotZ, rotY);
    viewMatrix = this.multiplyMatrices(viewMatrix, rotX);
    
    // Apply translation
    const translation = this.createTranslationMatrix(-position[0], -position[1], -position[2]);
    viewMatrix = this.multiplyMatrices(viewMatrix, translation);
    
    return viewMatrix;
  }

  // Frustum culling
  static isPointInFrustum(
    point: Point3D,
    camera: Camera,
    fov: number,
    aspect: number,
    near: number,
    far: number
  ): boolean {
    const distance = this.distanceToCamera(point, camera);
    
    // Basic distance culling
    if (distance < near || distance > far) {
      return false;
    }

    // TODO: Implement proper frustum culling with planes
    // For now, use simple distance-based culling
    return true;
  }

  // Bounding box calculations
  static calculateBoundingBox(points: Point3D[]): {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    size: Vector3;
  } {
    if (points.length === 0) {
      const zero = { x: 0, y: 0, z: 0 };
      return { min: zero, max: zero, center: zero, size: zero };
    }

    let minX = points[0].position[0];
    let minY = points[0].position[1];
    let minZ = points[0].position[2];
    let maxX = minX;
    let maxY = minY;
    let maxZ = minZ;

    for (const point of points) {
      const [x, y, z] = point.position;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    const min = { x: minX, y: minY, z: minZ };
    const max = { x: maxX, y: maxY, z: maxZ };
    const center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    };
    const size = {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ
    };

    return { min, max, center, size };
  }

  // LOD (Level of Detail) calculations
  static calculateLODLevel(
    point: Point3D,
    camera: Camera,
    maxDistance: number = 1000
  ): number {
    const distance = this.distanceToCamera(point, camera);
    const normalizedDistance = Math.min(distance / maxDistance, 1);
    
    // LOD levels: 1.0 (full detail) to 0.1 (minimal detail)
    return Math.max(0.1, 1.0 - normalizedDistance * 0.9);
  }

  // Clustering utilities
  static findNearestNeighbors(
    point: Point3D,
    points: Point3D[],
    maxNeighbors: number = 5,
    maxDistance: number = 100
  ): Point3D[] {
    const distances = points
      .filter(p => p.id !== point.id)
      .map(p => ({
        point: p,
        distance: this.distance3D(point, p)
      }))
      .filter(({ distance }) => distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxNeighbors);

    return distances.map(({ point }) => point);
  }

  // Smooth interpolation
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  static lerpVector3(a: Vector3, b: Vector3, t: number): Vector3 {
    return {
      x: this.lerp(a.x, b.x, t),
      y: this.lerp(a.y, b.y, t),
      z: this.lerp(a.z, b.z, t)
    };
  }

  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}