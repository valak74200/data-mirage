import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VisualizationProvider } from "@/stores/visualization-store";
import HomeNew from "@/pages/home-new";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeNew} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VisualizationProvider>
        <TooltipProvider>
          <div className="dark">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </VisualizationProvider>
    </QueryClientProvider>
  );
}

export default App;
