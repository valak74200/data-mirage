import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getStoredTokens } from "@/lib/auth";

interface UseWebSocketProps {
  onMessage?: (data: any) => void;
  enabled?: boolean;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

export function useWebSocket({ onMessage, enabled = true }: UseWebSocketProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const connect = useCallback(() => {
    if (!enabled) return;
    
    const tokens = getStoredTokens();
    if (!tokens) {
      console.log('No auth tokens available for WebSocket connection');
      return;
    }

    try {
      // Utiliser FastAPI WebSocket endpoint avec authentification JWT
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = import.meta.env.DEV ? 'localhost:8000' : window.location.host;
      const wsUrl = `${protocol}//${wsHost}/ws?token=${encodeURIComponent(tokens.access_token)}`;

      console.log('Connecting to WebSocket...', wsUrl.replace(/token=[^&]+/, 'token=***'));

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionAttempts(0);
        console.log('WebSocket connected successfully');
        
        toast({
          title: "Connected",
          description: "Real-time updates enabled",
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          onMessage?.(message);

          // Handle specific message types with improved UX
          switch (message.type) {
            case 'processing_started':
              toast({
                title: "Processing Started",
                description: "Dataset analysis has begun...",
              });
              break;
              
            case 'processing_progress':
              // Ne pas montrer de toast pour les messages de progrès pour éviter le spam
              console.log('Processing progress:', message.data);
              break;
              
            case 'processing_completed':
              toast({
                title: "Analysis Complete",
                description: "3D visualization is ready!",
              });
              break;
              
            case 'processing_error':
              toast({
                title: "Processing Error",
                description: message.data?.error || "An error occurred during processing",
                variant: "destructive",
              });
              break;
              
            case 'ml_results':
              toast({
                title: "ML Results Ready",
                description: "Machine learning analysis completed",
              });
              break;
              
            case 'dataset_uploaded':
              toast({
                title: "Dataset Uploaded",
                description: "Your dataset has been successfully uploaded",
              });
              break;
              
            default:
              console.log('Unhandled WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Reconnection logic si ce n'est pas une fermeture intentionnelle
        if (event.code !== 1000 && enabled && connectionAttempts < maxReconnectAttempts) {
          const attempts = connectionAttempts + 1;
          setConnectionAttempts(attempts);
          
          console.log(`Attempting to reconnect... (${attempts}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * attempts); // Backoff exponentiel
        } else if (connectionAttempts >= maxReconnectAttempts) {
          toast({
            title: "Connection Lost",
            description: "Unable to reconnect to real-time updates",
            variant: "destructive",
          });
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        
        if (connectionAttempts === 0) {
          toast({
            title: "Connection Error",
            description: "Failed to establish real-time connection",
            variant: "destructive",
          });
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [enabled, onMessage, toast, connectionAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Intentional disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionAttempts(0);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString()
      };
      
      wsRef.current.send(JSON.stringify(messageWithTimestamp));
      console.log('WebSocket message sent:', messageWithTimestamp);
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, []);

  // Effect pour établir la connexion
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return disconnect;
  }, [enabled, connect, disconnect]);

  // Cleanup au unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { 
    isConnected, 
    sendMessage, 
    reconnect: connect,
    disconnect,
    connectionAttempts 
  };
}
