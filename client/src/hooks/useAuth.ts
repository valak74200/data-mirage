import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { 
  authAPI, 
  User, 
  LoginCredentials, 
  RegisterCredentials,
  getStoredUser,
  getStoredTokens,
  clearAuthStorage
} from "@/lib/auth";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export function useAuth() {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);

  // Query pour récupérer l'utilisateur actuel
  const { 
    data: user, 
    isLoading: isUserLoading,
    error: userError,
    refetch: refetchUser
  } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authAPI.getCurrentUser(),
    retry: false,
    enabled: !!getStoredTokens() && isInitialized,
    meta: { requireAuth: true }
  });

  // Initialisation - vérifier si on a des tokens stockés
  useEffect(() => {
    const tokens = getStoredTokens();
    const storedUser = getStoredUser();
    
    if (tokens && storedUser) {
      // On a déjà un utilisateur en cache, on peut l'utiliser
      queryClient.setQueryData(queryKeys.currentUser(), storedUser);
    }
    
    setIsInitialized(true);
  }, [queryClient]);

  // Mutation pour la connexion
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authAPI.login(credentials),
    onSuccess: (authResponse) => {
      console.log('Login successful, updating auth state:', authResponse.user);
      
      // Mettre à jour le cache avec l'utilisateur
      queryClient.setQueryData(queryKeys.currentUser(), authResponse.user);
      
      // Forcer une invalidation pour s'assurer que l'état est à jour
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      
      // Trigger a re-render by invalidating all queries to ensure auth state updates
      queryClient.invalidateQueries();
      
      toast({
        title: "Welcome back!",
        description: `Logged in as ${authResponse.user.email}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour l'inscription
  const registerMutation = useMutation({
    mutationFn: (credentials: RegisterCredentials) => authAPI.register(credentials),
    onSuccess: (authResponse) => {
      // Mettre à jour le cache avec l'utilisateur
      queryClient.setQueryData(queryKeys.currentUser(), authResponse.user);
      
      // Forcer une invalidation pour s'assurer que l'état est à jour
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      
      // Trigger a re-render by invalidating all queries to ensure auth state updates
      queryClient.invalidateQueries();
      
      toast({
        title: "Welcome to Data Mirage!",
        description: `Account created for ${authResponse.user.email}`,
      });
      
      // Small delay to ensure state propagation across all components
      setTimeout(() => {
        // Force re-evaluation of authentication state
        queryClient.invalidateQueries();
      }, 50);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour la déconnexion
  const logoutMutation = useMutation({
    mutationFn: () => authAPI.logout(),
    onSuccess: () => {
      // Nettoyer tous les caches
      queryClient.clear();
      
      // Forcer un redirect vers la page d'accueil
      window.location.href = '/';
    },
    onError: (error: Error) => {
      console.error('Logout error:', error);
      // Même en cas d'erreur, nettoyer le cache local
      clearAuthStorage();
      queryClient.clear();
      window.location.href = '/';
    },
  });

  // Fonctions utilitaires
  const login = useCallback((credentials: LoginCredentials) => {
    return loginMutation.mutateAsync(credentials);
  }, [loginMutation]);

  const register = useCallback((credentials: RegisterCredentials) => {
    return registerMutation.mutateAsync(credentials);
  }, [registerMutation]);

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const refreshUser = useCallback(() => {
    return refetchUser();
  }, [refetchUser]);

  // Gestion des erreurs d'authentification
  useEffect(() => {
    if (userError && isInitialized) {
      console.error('Auth error:', userError);
      // Si on ne peut pas récupérer l'utilisateur avec des tokens stockés,
      // c'est probablement que les tokens sont invalides
      clearAuthStorage();
    }
  }, [userError, isInitialized]);

  // Déterminer l'état de chargement global
  const isLoading = !isInitialized || (isUserLoading && !!getStoredTokens());

  // Déterminer si l'utilisateur est authentifié
  // Vérifier d'abord les tokens stockés, puis l'utilisateur en cache
  const storedTokens = getStoredTokens();
  const storedUser = getStoredUser();
  const isAuthenticated = !!((user || storedUser) && storedTokens && isInitialized);

  // Debug logging
  console.log('useAuth state:', {
    user: !!user,
    userEmail: user?.email,
    storedUser: !!storedUser,
    storedUserEmail: storedUser?.email,
    storedTokens: !!storedTokens,
    isInitialized,
    isAuthenticated,
    isLoading,
    userError: !!userError,
    isUserLoading
  });

  // États des mutations
  const isLoggingIn = loginMutation.isPending;
  const isRegistering = registerMutation.isPending;
  const isLoggingOut = logoutMutation.isPending;

  return {
    // État utilisateur
    user,
    isLoading,
    isAuthenticated,
    isInitialized,
    
    // Actions
    login,
    register,
    logout,
    refreshUser,
    
    // États des actions
    isLoggingIn,
    isRegistering,
    isLoggingOut,
    
    // Erreurs
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    userError,
  };
}