import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { VisualizationProvider } from "@/stores/visualization-store";
import Landing from "@/pages/landing";
import Datasets from "@/pages/datasets";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-400 border-t-transparent"></div>
        <div className="text-cyan-400 text-lg font-medium">
          Loading Data Mirage...
        </div>
      </div>
    </div>
  );
}

// Error boundary component
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {children}
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, isInitialized } = useAuth();

  // Show loading while checking authentication
  if (!isInitialized || isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to landing if not authenticated
  if (!isAuthenticated) {
    return <Landing />;
  }

  return <Component />;
}

// Main router component with clean authentication handling
function Router() {
  const { isAuthenticated, isLoading, isInitialized, user } = useAuth();

  // Show loading spinner while initializing authentication
  if (!isInitialized || isLoading) {
    return <LoadingSpinner />;
  }

  // Log authentication state for debugging
  console.log('Router - Auth state:', { 
    isAuthenticated, 
    isInitialized, 
    isLoading,
    user: !!user,
    userEmail: user?.email 
  });

  return (
    <ErrorBoundary>
      <Switch>
        {/* Public routes */}
        <Route path="/landing" component={Landing} />
        
        {/* Main route - shows landing if not authenticated, dashboard if authenticated */}
        <Route path="/">
          {isAuthenticated ? <Home /> : <Landing />}
        </Route>
        
        {/* Protected routes */}
        <Route path="/dashboard">
          <ProtectedRoute component={Home} />
        </Route>
        
        <Route path="/datasets">
          <ProtectedRoute component={Datasets} />
        </Route>
        
        {/* Catch-all route for 404 */}
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VisualizationProvider>
        <div className="min-h-screen bg-background">
          <Router />
          <Toaster />
        </div>
      </VisualizationProvider>
      
      {/* React Query Devtools - only in development */}
      {import.meta.env.DEV && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          position="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

export default App;