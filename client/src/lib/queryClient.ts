import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authAPI, isAuthError } from "./auth";

// Configuration API FastAPI
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Fonction utilitaire pour les requêtes API avec authentification automatique
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  requireAuth: boolean = true
): Promise<Response> {
  const fullUrl = `${API_BASE_URL}${url}`;
  
  if (requireAuth) {
    // Utiliser le service d'authentification pour les requêtes authentifiées
    return await authAPI.makeAuthenticatedRequest(url, {
      method,
      body: data ? JSON.stringify(data) : undefined,
    });
  } else {
    // Requêtes non authentifiées (login, register)
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
    });

    await throwIfResNotOk(res);
    return res;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, meta }) => {
    const url = queryKey.join("/");
    const requireAuth = meta?.requireAuth !== false;
    
    try {
      let res: Response;
      
      if (requireAuth) {
        res = await authAPI.makeAuthenticatedRequest(url);
      } else {
        const fullUrl = `${API_BASE_URL}${url}`;
        res = await fetch(fullUrl, {
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      if (res.status === 401 && unauthorizedBehavior === "returnNull") {
        return null;
      }

      await throwIfResNotOk(res);
      
      // Gérer les réponses vides ou non-JSON
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await res.json();
      } else {
        return await res.text();
      }
    } catch (error) {
      if (isAuthError(error) && unauthorizedBehavior === "returnNull") {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Ne pas retry les erreurs d'authentification
        if (isAuthError(error)) {
          return false;
        }
        // Retry maximum 2 fois pour les autres erreurs
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Ne jamais retry les mutations en cas d'erreur d'authentification
        if (isAuthError(error)) {
          return false;
        }
        // Retry une seule fois pour les autres erreurs
        return failureCount < 1;
      },
    },
  },
});

// Utilitaires pour les requêtes communes
export const queryKeys = {
  // Authentification
  currentUser: () => ["/api/auth/me"] as const,
  
  // Datasets
  datasets: () => ["/api/datasets"] as const,
  dataset: (id: string) => ["/api/datasets", id] as const,
  
  // ML
  mlAlgorithms: () => ["/api/ml/algorithms"] as const,
  mlStatus: (taskId: string) => ["/api/ml/status", taskId] as const,
  mlResults: (taskId: string) => ["/api/ml/results", taskId] as const,
} as const;
