import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import AppLayout from "@/components/layouts/AppLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ClientsPage from "@/pages/clients/index";
import ClientsByTypePage from "@/pages/clients/[type]";
import PropertiesPage from "@/pages/properties/index";
import AppointmentsPage from "@/pages/appointments/index";
import TasksPage from "@/pages/tasks/index";
import AnalyticsPage from "@/pages/analytics/index";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/:type" component={ClientsByTypePage} />
      <Route path="/properties" component={PropertiesPage} />
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="realestate-crm-theme">
        <TooltipProvider>
          <Toaster />
          <AppLayout>
            <Router />
          </AppLayout>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
