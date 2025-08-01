import { MLConfig, DataPoint, ProcessingResult } from "@shared/schema";

// Simplified ML processing for demonstration
// In production, this would integrate with Python services
export class MLProcessor {
  async processDataset(
    data: Record<string, any>[],
    config: MLConfig
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    // Extract numeric columns for processing
    const numericColumns = this.extractNumericColumns(data);
    
    // Apply dimensionality reduction (simplified)
    const reducedPositions = this.applyDimensionalityReduction(
      data,
      numericColumns,
      config.reductionMethod
    );

    // Apply clustering
    const clusterResults = this.applyClustering(
      reducedPositions,
      config.clusteringMethod,
      config.numClusters
    );

    // Detect anomalies if requested
    const anomalies = config.detectAnomalies 
      ? this.detectAnomalies(reducedPositions, clusterResults.labels)
      : [];

    // Generate data points
    const points: DataPoint[] = data.map((row, index) => ({
      id: `point_${index}`,
      originalIndex: index,
      position: reducedPositions[index],
      color: this.getPointColor(row, config.colorColumn, clusterResults.labels[index]),
      size: this.getPointSize(row, config.sizeColumn),
      cluster: clusterResults.labels[index],
      isAnomaly: anomalies.includes(index),
      originalData: row,
    }));

    const clusters = clusterResults.centers.map((center, index) => ({
      id: index,
      color: this.getClusterColor(index),
      count: clusterResults.labels.filter(label => label === index).length,
      label: `Cluster ${index + 1}`,
    }));

    const processingTime = Date.now() - startTime;

    return {
      points,
      clusters,
      anomalies,
      metadata: {
        totalPoints: data.length,
        processingTime,
        reductionMethod: config.reductionMethod,
        clusteringMethod: config.clusteringMethod,
      },
    };
  }

  private extractNumericColumns(data: Record<string, any>[]): string[] {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    return Object.keys(firstRow).filter(key => 
      typeof firstRow[key] === 'number' && !isNaN(firstRow[key])
    );
  }

  private applyDimensionalityReduction(
    data: Record<string, any>[],
    numericColumns: string[],
    method: 'tsne' | 'umap'
  ): [number, number, number][] {
    if (numericColumns.length === 0) {
      // If no numeric columns, create random positions
      return data.map(() => [
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 50,
      ] as [number, number, number]);
    }

    // Extract and normalize numeric data
    const numericData = data.map(row => 
      numericColumns.map(col => {
        const val = parseFloat(row[col]);
        return isNaN(val) ? 0 : val;
      })
    );

    // Normalize data to [0, 1] range
    const normalizedData = this.normalizeMatrix(numericData);

    if (method === 'tsne') {
      return this.simpleTSNE(normalizedData);
    } else {
      return this.simpleUMAP(normalizedData);
    }
  }

  private normalizeMatrix(data: number[][]): number[][] {
    if (data.length === 0) return data;
    
    const numFeatures = data[0].length;
    const mins = new Array(numFeatures).fill(Infinity);
    const maxs = new Array(numFeatures).fill(-Infinity);

    // Find min and max for each feature
    data.forEach(row => {
      row.forEach((val, i) => {
        mins[i] = Math.min(mins[i], val);
        maxs[i] = Math.max(maxs[i], val);
      });
    });

    // Normalize
    return data.map(row => 
      row.map((val, i) => {
        const range = maxs[i] - mins[i];
        return range === 0 ? 0 : (val - mins[i]) / range;
      })
    );
  }

  private simpleTSNE(data: number[][]): [number, number, number][] {
    // Simplified t-SNE implementation using PCA + random projection
    const pca = this.simplePCA(data, 3);
    
    return pca.map(point => [
      point[0] * 60,
      point[1] * 60,
      point[2] * 30,
    ] as [number, number, number]);
  }

  private simpleUMAP(data: number[][]): [number, number, number][] {
    // Simplified UMAP-like embedding
    const embedding = this.simplePCA(data, 3);
    
    // Add some non-linear transformation
    return embedding.map(point => [
      Math.tanh(point[0]) * 50,
      Math.tanh(point[1]) * 50,
      Math.tanh(point[2]) * 25,
    ] as [number, number, number]);
  }

  private simplePCA(data: number[][], components: number): number[][] {
    if (data.length === 0) return [];
    
    const n = data.length;
    const d = data[0].length;
    
    // Center the data
    const means = new Array(d).fill(0);
    data.forEach(row => {
      row.forEach((val, i) => means[i] += val);
    });
    means.forEach((_, i) => means[i] /= n);
    
    const centeredData = data.map(row => 
      row.map((val, i) => val - means[i])
    );

    // For simplicity, just return the first few dimensions with some rotation
    const result: number[][] = [];
    for (let i = 0; i < n; i++) {
      const point = [];
      for (let j = 0; j < Math.min(components, d); j++) {
        if (j < d) {
          point.push(centeredData[i][j]);
        } else {
          point.push(0);
        }
      }
      // Add more dimensions if needed
      while (point.length < components) {
        point.push((Math.random() - 0.5) * 0.1);
      }
      result.push(point);
    }
    
    return result;
  }

  private applyClustering(
    positions: [number, number, number][],
    method: 'kmeans' | 'dbscan',
    numClusters: number
  ): { labels: number[]; centers: [number, number, number][] } {
    if (method === 'kmeans') {
      return this.kMeansClustering(positions, numClusters);
    } else {
      return this.dbscanClustering(positions);
    }
  }

  private kMeansClustering(
    positions: [number, number, number][],
    k: number
  ): { labels: number[]; centers: [number, number, number][] } {
    if (positions.length === 0) return { labels: [], centers: [] };
    
    // Initialize centroids randomly
    let centroids: [number, number, number][] = [];
    for (let i = 0; i < k; i++) {
      const randomPoint = positions[Math.floor(Math.random() * positions.length)];
      centroids.push([...randomPoint] as [number, number, number]);
    }

    let labels = new Array(positions.length).fill(0);
    let prevLabels: number[] = [];

    // K-means iterations
    for (let iter = 0; iter < 50; iter++) {
      prevLabels = [...labels];

      // Assign points to nearest centroid
      labels = positions.map(point => {
        let minDist = Infinity;
        let closestCentroid = 0;
        
        centroids.forEach((centroid, i) => {
          const dist = this.euclideanDistance(point, centroid);
          if (dist < minDist) {
            minDist = dist;
            closestCentroid = i;
          }
        });
        
        return closestCentroid;
      });

      // Update centroids
      for (let i = 0; i < k; i++) {
        const clusterPoints = positions.filter((_, index) => labels[index] === i);
        if (clusterPoints.length > 0) {
          centroids[i] = [
            clusterPoints.reduce((sum, p) => sum + p[0], 0) / clusterPoints.length,
            clusterPoints.reduce((sum, p) => sum + p[1], 0) / clusterPoints.length,
            clusterPoints.reduce((sum, p) => sum + p[2], 0) / clusterPoints.length,
          ];
        }
      }

      // Check convergence
      if (JSON.stringify(labels) === JSON.stringify(prevLabels)) {
        break;
      }
    }

    return { labels, centers: centroids };
  }

  private dbscanClustering(
    positions: [number, number, number][]
  ): { labels: number[]; centers: [number, number, number][] } {
    const eps = 15; // Neighborhood radius
    const minPts = 3; // Minimum points to form a cluster
    
    const labels = new Array(positions.length).fill(-1); // -1 means noise
    let clusterId = 0;

    for (let i = 0; i < positions.length; i++) {
      if (labels[i] !== -1) continue; // Already processed

      const neighbors = this.regionQuery(positions, i, eps);
      
      if (neighbors.length < minPts) {
        labels[i] = -1; // Mark as noise
      } else {
        this.expandCluster(positions, labels, i, neighbors, clusterId, eps, minPts);
        clusterId++;
      }
    }

    // Calculate cluster centers
    const centers: [number, number, number][] = [];
    for (let i = 0; i < clusterId; i++) {
      const clusterPoints = positions.filter((_, index) => labels[index] === i);
      if (clusterPoints.length > 0) {
        centers.push([
          clusterPoints.reduce((sum, p) => sum + p[0], 0) / clusterPoints.length,
          clusterPoints.reduce((sum, p) => sum + p[1], 0) / clusterPoints.length,
          clusterPoints.reduce((sum, p) => sum + p[2], 0) / clusterPoints.length,
        ]);
      }
    }

    return { labels, centers };
  }

  private regionQuery(positions: [number, number, number][], pointIndex: number, eps: number): number[] {
    const neighbors: number[] = [];
    const point = positions[pointIndex];
    
    for (let i = 0; i < positions.length; i++) {
      if (this.euclideanDistance(point, positions[i]) <= eps) {
        neighbors.push(i);
      }
    }
    
    return neighbors;
  }

  private expandCluster(
    positions: [number, number, number][],
    labels: number[],
    pointIndex: number,
    neighbors: number[],
    clusterId: number,
    eps: number,
    minPts: number
  ): void {
    labels[pointIndex] = clusterId;
    
    for (let i = 0; i < neighbors.length; i++) {
      const neighborIndex = neighbors[i];
      
      if (labels[neighborIndex] === -1) {
        labels[neighborIndex] = clusterId;
        
        const neighborNeighbors = this.regionQuery(positions, neighborIndex, eps);
        if (neighborNeighbors.length >= minPts) {
          neighbors.push(...neighborNeighbors);
        }
      }
    }
  }

  private euclideanDistance(p1: [number, number, number], p2: [number, number, number]): number {
    return Math.sqrt(
      Math.pow(p1[0] - p2[0], 2) +
      Math.pow(p1[1] - p2[1], 2) +
      Math.pow(p1[2] - p2[2], 2)
    );
  }

  private detectAnomalies(
    positions: [number, number, number][],
    labels: number[]
  ): number[] {
    if (positions.length === 0) return [];
    
    // Calculate cluster centers
    const clusterCenters = new Map<number, [number, number, number]>();
    const clusterSizes = new Map<number, number>();
    
    // Group points by cluster
    positions.forEach((pos, index) => {
      const label = labels[index];
      if (label === -1) return; // Skip noise points
      
      if (!clusterCenters.has(label)) {
        clusterCenters.set(label, [0, 0, 0]);
        clusterSizes.set(label, 0);
      }
      
      const center = clusterCenters.get(label)!;
      center[0] += pos[0];
      center[1] += pos[1];
      center[2] += pos[2];
      clusterSizes.set(label, clusterSizes.get(label)! + 1);
    });
    
    // Calculate actual centers
    clusterCenters.forEach((center, label) => {
      const size = clusterSizes.get(label)!;
      center[0] /= size;
      center[1] /= size;
      center[2] /= size;
    });
    
    // Calculate average distances within clusters
    const clusterStats = new Map<number, { distances: number[]; threshold: number }>();
    
    positions.forEach((pos, index) => {
      const label = labels[index];
      if (label === -1) return;
      
      const center = clusterCenters.get(label);
      if (!center) return;
      
      const distance = this.euclideanDistance(pos, center);
      
      if (!clusterStats.has(label)) {
        clusterStats.set(label, { distances: [], threshold: 0 });
      }
      
      clusterStats.get(label)!.distances.push(distance);
    });
    
    // Calculate thresholds (mean + 2*std)
    clusterStats.forEach((stats, label) => {
      const distances = stats.distances;
      const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
      const std = Math.sqrt(variance);
      stats.threshold = mean + 2 * std;
    });
    
    // Find anomalies
    const anomalies: number[] = [];
    
    positions.forEach((pos, index) => {
      const label = labels[index];
      
      // Noise points are always anomalies
      if (label === -1) {
        anomalies.push(index);
        return;
      }
      
      const center = clusterCenters.get(label);
      const stats = clusterStats.get(label);
      
      if (center && stats) {
        const distance = this.euclideanDistance(pos, center);
        if (distance > stats.threshold) {
          anomalies.push(index);
        }
      }
    });
    
    return anomalies;
  }

  private getPointColor(
    row: Record<string, any>,
    colorColumn?: string,
    cluster?: number
  ): string {
    if (colorColumn && row[colorColumn] !== undefined) {
      // Color based on column value
      const value = row[colorColumn];
      if (typeof value === 'string') {
        return this.getCategoricalColor(value);
      } else if (typeof value === 'number') {
        return this.getNumericalColor(value);
      }
    }
    
    // Default to cluster color
    return this.getClusterColor(cluster || 0);
  }

  private getPointSize(row: Record<string, any>, sizeColumn?: string): number {
    if (sizeColumn && row[sizeColumn] !== undefined) {
      const value = row[sizeColumn];
      if (typeof value === 'number') {
        // Normalize to size range 0.5 - 2.0
        return Math.max(0.5, Math.min(2.0, value / 10));
      }
    }
    return 1.0; // Default size
  }

  private getClusterColor(cluster: number): string {
    const colors = ['#00ffff', '#00ff88', '#8b5cf6', '#ff6b6b', '#ffd93d', '#74c0fc'];
    return colors[cluster % colors.length];
  }

  private getCategoricalColor(value: string): string {
    // Simple hash-based color assignment
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  private getNumericalColor(value: number): string {
    // Map numerical value to color spectrum
    const normalized = Math.max(0, Math.min(1, value / 100));
    const hue = (1 - normalized) * 240; // Blue to red
    return `hsl(${hue}, 70%, 60%)`;
  }
}

export const mlProcessor = new MLProcessor();
