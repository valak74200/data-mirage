import { type Dataset, type InsertDataset, type Visualization, type InsertVisualization } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Dataset operations
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  getDataset(id: string): Promise<Dataset | undefined>;
  getAllDatasets(): Promise<Dataset[]>;
  deleteDataset(id: string): Promise<boolean>;

  // Visualization operations
  createVisualization(visualization: InsertVisualization): Promise<Visualization>;
  getVisualization(id: string): Promise<Visualization | undefined>;
  getVisualizationsByDataset(datasetId: string): Promise<Visualization[]>;
  updateVisualization(id: string, updates: Partial<Visualization>): Promise<Visualization | undefined>;
  deleteVisualization(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private datasets: Map<string, Dataset>;
  private visualizations: Map<string, Visualization>;

  constructor() {
    this.datasets = new Map();
    this.visualizations = new Map();
  }

  async createDataset(insertDataset: InsertDataset): Promise<Dataset> {
    const id = randomUUID();
    const dataset: Dataset = {
      ...insertDataset,
      id,
      processedData: null,
      createdAt: new Date(),
    };
    this.datasets.set(id, dataset);
    return dataset;
  }

  async getDataset(id: string): Promise<Dataset | undefined> {
    return this.datasets.get(id);
  }

  async getAllDatasets(): Promise<Dataset[]> {
    return Array.from(this.datasets.values());
  }

  async deleteDataset(id: string): Promise<boolean> {
    return this.datasets.delete(id);
  }

  async createVisualization(insertVisualization: InsertVisualization): Promise<Visualization> {
    const id = randomUUID();
    const visualization: Visualization = {
      ...insertVisualization,
      id,
      reducedData: null,
      clusterData: null,
      createdAt: new Date(),
    };
    this.visualizations.set(id, visualization);
    return visualization;
  }

  async getVisualization(id: string): Promise<Visualization | undefined> {
    return this.visualizations.get(id);
  }

  async getVisualizationsByDataset(datasetId: string): Promise<Visualization[]> {
    return Array.from(this.visualizations.values()).filter(
      (viz) => viz.datasetId === datasetId
    );
  }

  async updateVisualization(id: string, updates: Partial<Visualization>): Promise<Visualization | undefined> {
    const visualization = this.visualizations.get(id);
    if (!visualization) return undefined;

    const updated = { ...visualization, ...updates };
    this.visualizations.set(id, updated);
    return updated;
  }

  async deleteVisualization(id: string): Promise<boolean> {
    return this.visualizations.delete(id);
  }
}

export const storage = new MemStorage();
