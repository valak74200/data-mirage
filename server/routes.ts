import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { mlProcessor } from "./services/ml-processor";
import { insertDatasetSchema, insertVisualizationSchema, mlConfigSchema } from "@shared/schema";
import { RAGService } from "./services/rag-service";
import { ProcessingResult } from "../shared/types";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication first
  await setupAuth(app);
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message:', data);
        
        // Handle real-time processing requests
        if (data.type === 'process_dataset') {
          ws.send(JSON.stringify({
            type: 'processing_started',
            message: 'Starting data processing...'
          }));
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // Dataset routes
  app.post('/api/datasets', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { fileName, fileContent, mimeType } = req.body;
      const userId = (req as any).user?.claims?.sub;
      
      if (!fileContent || !fileName) {
        return res.status(400).json({ error: 'No file content or name provided' });
      }

      let data: any[];
      
      // Parse CSV or JSON
      if (mimeType === 'application/json' || fileName.endsWith('.json')) {
        data = JSON.parse(fileContent);
      } else {
        // Simple CSV parser
        const lines = fileContent.split('\n').filter((line: string) => line.trim());
        const headers = lines[0].split(',').map((h: string) => h.trim());
        data = lines.slice(1).map((line: string) => {
          const values = line.split(',').map((v: string) => v.trim());
          const row: any = {};
          headers.forEach((header: string, index: number) => {
            const value = values[index];
            // Try to parse as number
            const numValue = parseFloat(value);
            row[header] = isNaN(numValue) ? value : numValue;
          });
          return row;
        });
      }

      const metadata = {
        fileName: fileName,
        fileSize: fileContent.length,
        rowCount: data.length,
        columnCount: data.length > 0 ? Object.keys(data[0]).length : 0,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        uploadedAt: new Date().toISOString(),
      };

      const dataset = await storage.createDataset({
        name: fileName,
        originalData: data,
        metadata,
      }, userId);

      res.json(dataset);
    } catch (error) {
      console.error('Dataset upload error:', error);
      res.status(500).json({ error: 'Failed to process dataset' });
    }
  });

  // Add auth route before datasets
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get('/api/datasets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const datasets = await storage.getAllDatasets(userId);
      res.json(datasets);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch datasets' });
    }
  });

  app.get('/api/datasets/:id', async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      res.json(dataset);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dataset' });
    }
  });

  // Visualization routes
  app.post('/api/visualizations', async (req, res) => {
    try {
      const validatedData = insertVisualizationSchema.parse(req.body);
      const visualization = await storage.createVisualization(validatedData);
      res.json(visualization);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid visualization data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create visualization' });
    }
  });

  app.get('/api/visualizations/:id', async (req, res) => {
    try {
      const visualization = await storage.getVisualization(req.params.id);
      if (!visualization) {
        return res.status(404).json({ error: 'Visualization not found' });
      }
      res.json(visualization);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch visualization' });
    }
  });

  // Initialize RAG service
  const ragService = new RAGService();

  // ML Processing route with RAG explanations
  app.post('/api/process/:datasetId', isAuthenticated, async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.datasetId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      const config = mlConfigSchema.parse(req.body);
      
      // Broadcast processing start to connected WebSocket clients
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'processing_started',
            datasetId: req.params.datasetId,
            config
          }));
        }
      });

      const result = await mlProcessor.processDataset(
        dataset.originalData as Record<string, any>[],
        config
      ) as ProcessingResult;

      // Generate AI explanations for clusters
      try {
        const explanations = await ragService.explainClusters(result, dataset.metadata);
        result.explanations = explanations;
        
        // Broadcast RAG completion
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'rag_completed',
              datasetId: req.params.datasetId,
              explanations
            }));
          }
        });
      } catch (ragError) {
        console.error('RAG explanation error:', ragError);
        // Continue without explanations if RAG fails
        result.explanations = result.clusters.map(cluster => ({
          clusterId: cluster.id,
          explanation: `Cluster ${cluster.id} contient ${cluster.points.length} points de données avec des caractéristiques similaires.`,
          characteristics: ['Données groupées par similarité'],
          dataPoints: cluster.points.length,
          keyFeatures: ['Patron identifié']
        }));
      }

      // Broadcast processing completion
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'processing_completed',
            datasetId: req.params.datasetId,
            result
          }));
        }
      });

      res.json(result);
    } catch (error) {
      console.error('Processing error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid processing config', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to process dataset' });
    }
  });

  return httpServer;
}
