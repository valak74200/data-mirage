import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const datasets = pgTable("datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  originalData: jsonb("original_data").notNull(),
  processedData: jsonb("processed_data"),
  metadata: jsonb("metadata").notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const visualizations = pgTable("visualizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").references(() => datasets.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  config: jsonb("config").notNull(),
  reducedData: jsonb("reduced_data"),
  clusterData: jsonb("cluster_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDatasetSchema = createInsertSchema(datasets).pick({
  name: true,
  originalData: true,
  metadata: true,
});

export const insertVisualizationSchema = createInsertSchema(visualizations).pick({
  datasetId: true,
  config: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type Dataset = typeof datasets.$inferSelect;
export type InsertVisualization = z.infer<typeof insertVisualizationSchema>;
export type Visualization = typeof visualizations.$inferSelect;

// ML Processing types
export const mlConfigSchema = z.object({
  reductionMethod: z.enum(['tsne', 'umap']),
  clusteringMethod: z.enum(['kmeans', 'dbscan']),
  numClusters: z.number().min(2).max(20).optional(),
  colorColumn: z.string().optional(),
  sizeColumn: z.string().optional(),
  detectAnomalies: z.boolean(),
});

export type MLConfig = z.infer<typeof mlConfigSchema>;

export interface DataPoint {
  id: string;
  originalIndex: number;
  position: [number, number, number];
  color: string;
  size: number;
  cluster?: number;
  isAnomaly?: boolean;
  originalData: Record<string, any>;
}

export interface ProcessingResult {
  points: DataPoint[];
  clusters: {
    id: number;
    color: string;
    count: number;
    label: string;
  }[];
  anomalies: number[];
  metadata: {
    totalPoints: number;
    processingTime: number;
    reductionMethod: string;
    clusteringMethod: string;
  };
}
