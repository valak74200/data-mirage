import { toast } from "@/hooks/use-toast";

// Configuration API
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

// Types pour l'authentification JWT
export interface User {
  id: string;
  email: string;
  name?: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  confirm_password: string;
  name?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// Gestion sécurisée des tokens dans localStorage
const TOKEN_STORAGE_KEY = 'data_mirage_tokens';
const USER_STORAGE_KEY = 'data_mirage_user';

export function getStoredTokens(): AuthTokens | null {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: AuthTokens | null): void {
  if (tokens) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

// Vérification de l'expiration du token
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch {
    return true;
  }
}

// Service API avec gestion automatique des tokens
class AuthAPI {
  private refreshPromise: Promise<AuthTokens | null> | null = null;

  async makeAuthenticatedRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const tokens = await this.getValidTokens();
    
    if (!tokens) {
      throw new Error('No valid authentication tokens');
    }

    const headers: Record<string, string> = {
      ...options.headers,
      'Authorization': `Bearer ${tokens.access_token}`,
    };

    // Only set Content-Type if not explicitly provided and body is not FormData
    if (!options.headers?.['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    // Si 401, essayer de refresh une seule fois
    if (response.status === 401 && !options.headers?.['X-No-Retry']) {
      const newTokens = await this.refreshTokens();
      if (newTokens) {
        return this.makeAuthenticatedRequest(url, {
          ...options,
          headers: {
            ...options.headers,
            'X-No-Retry': 'true'
          }
        });
      }
    }

    return response;
  }

  async getValidTokens(): Promise<AuthTokens | null> {
    const tokens = getStoredTokens();
    
    if (!tokens) {
      return null;
    }

    // Si le token d'accès n'est pas expiré, le retourner
    if (!isTokenExpired(tokens.access_token)) {
      return tokens;
    }

    // Sinon, essayer de le rafraîchir
    return await this.refreshTokens();
  }

  async refreshTokens(): Promise<AuthTokens | null> {
    // Éviter les appels parallèles au refresh
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._performRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    
    return result;
  }

  private async _performRefresh(): Promise<AuthTokens | null> {
    const tokens = getStoredTokens();
    
    if (!tokens?.refresh_token) {
      this.handleAuthFailure();
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: tokens.refresh_token
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokens: AuthTokens = await response.json();
      setStoredTokens(newTokens);
      
      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.handleAuthFailure();
      return null;
    }
  }

  private handleAuthFailure(): void {
    clearAuthStorage();
    
    toast({
      title: "Session Expired",
      description: "Please log in again to continue.",
      variant: "destructive",
    });

    // Rediriger vers la page de login si on n'y est pas déjà
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Login failed');
    }

    const tokenResponse = await response.json();
    
    // Adapter la structure de réponse du backend
    const authResponse: AuthResponse = {
      user: tokenResponse.user,
      tokens: {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        token_type: tokenResponse.token_type
      }
    };
    
    // Stocker les tokens et l'utilisateur
    setStoredTokens(authResponse.tokens);
    setStoredUser(authResponse.user);
    
    return authResponse;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Registration failed');
    }

    const tokenResponse = await response.json();
    
    // Adapter la structure de réponse du backend
    const authResponse: AuthResponse = {
      user: tokenResponse.user,
      tokens: {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        token_type: tokenResponse.token_type
      }
    };
    
    // Stocker les tokens et l'utilisateur
    setStoredTokens(authResponse.tokens);
    setStoredUser(authResponse.user);
    
    return authResponse;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.makeAuthenticatedRequest('/api/auth/me');
      
      if (!response.ok) {
        return null;
      }

      const user: User = await response.json();
      setStoredUser(user);
      
      return user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    const tokens = getStoredTokens();
    
    // Essayer de faire un logout côté serveur
    if (tokens) {
      try {
        await this.makeAuthenticatedRequest('/api/auth/logout', {
          method: 'POST',
        });
      } catch (error) {
        console.error('Server logout failed:', error);
      }
    }

    // Nettoyer le stockage local
    clearAuthStorage();
    
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  }
}

// Instance singleton du service d'authentification
export const authAPI = new AuthAPI();

// Utilitaires pour la validation des erreurs
export function isUnauthorizedError(error: Error): boolean {
  return error.message.includes('No valid authentication tokens') ||
         error.message.includes('401') ||
         error.message.includes('Unauthorized');
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return isUnauthorizedError(error);
  }
  return false;
}