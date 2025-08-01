import {
  users,
  datasets,
  visualizations,
  type User,
  type UpsertUser,
  type Dataset,
  type InsertDataset,
  type Visualization,
  type InsertVisualization,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations for authentication
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Dataset operations
  createDataset(dataset: InsertDataset, userId?: string): Promise<Dataset>;
  getDataset(id: string): Promise<Dataset | undefined>;
  getAllDatasets(userId?: string): Promise<Dataset[]>;
  getUserDatasets(userId: string): Promise<Dataset[]>;
  deleteDataset(id: string): Promise<boolean>;

  // Visualization operations
  createVisualization(visualization: InsertVisualization, userId?: string): Promise<Visualization>;
  getVisualization(id: string): Promise<Visualization | undefined>;
  getVisualizationsByDataset(datasetId: string): Promise<Visualization[]>;
  getUserVisualizations(userId: string): Promise<Visualization[]>;
  updateVisualization(id: string, updates: Partial<Visualization>): Promise<Visualization | undefined>;
  deleteVisualization(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations for authentication
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Dataset operations
  async createDataset(insertDataset: InsertDataset, userId?: string): Promise<Dataset> {
    const datasetData = {
      ...insertDataset,
      userId,
    };
    
    const [dataset] = await db
      .insert(datasets)
      .values(datasetData)
      .returning();
    return dataset;
  }

  async getDataset(id: string): Promise<Dataset | undefined> {
    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id));
    return dataset;
  }

  async getAllDatasets(userId?: string): Promise<Dataset[]> {
    if (userId) {
      return await db.select().from(datasets).where(eq(datasets.userId, userId));
    }
    return await db.select().from(datasets);
  }

  async getUserDatasets(userId: string): Promise<Dataset[]> {
    return await db.select().from(datasets).where(eq(datasets.userId, userId));
  }

  async deleteDataset(id: string): Promise<boolean> {
    const result = await db.delete(datasets).where(eq(datasets.id, id));
    return result.rowCount > 0;
  }

  // Visualization operations
  async createVisualization(insertVisualization: InsertVisualization, userId?: string): Promise<Visualization> {
    const visualizationData = {
      ...insertVisualization,
      userId,
    };
    
    const [visualization] = await db
      .insert(visualizations)
      .values(visualizationData)
      .returning();
    return visualization;
  }

  async getVisualization(id: string): Promise<Visualization | undefined> {
    const [visualization] = await db.select().from(visualizations).where(eq(visualizations.id, id));
    return visualization;
  }

  async getVisualizationsByDataset(datasetId: string): Promise<Visualization[]> {
    return await db.select().from(visualizations).where(eq(visualizations.datasetId, datasetId));
  }

  async getUserVisualizations(userId: string): Promise<Visualization[]> {
    return await db.select().from(visualizations).where(eq(visualizations.userId, userId));
  }

  async updateVisualization(id: string, updates: Partial<Visualization>): Promise<Visualization | undefined> {
    const [visualization] = await db
      .update(visualizations)
      .set(updates)
      .where(eq(visualizations.id, id))
      .returning();
    return visualization;
  }

  async deleteVisualization(id: string): Promise<boolean> {
    const result = await db.delete(visualizations).where(eq(visualizations.id, id));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();