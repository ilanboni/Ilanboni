import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import AppLayout from "@/components/layouts/AppLayout";
import { AddressAutocompleteProvider } from "@/components/address/AddressAutocompleteProvider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ClientsPage from "@/pages/clients/index";
import ClientsByTypePage from "@/pages/clients/[type]";
import ClientDetailPage from "@/pages/clients/[id]";
import ClientPropertySearchPage from "@/pages/clients/[id]/search";
import PropertiesPage from "@/pages/properties/index";
import PropertyDetailPage from "@/pages/properties/[id]";
// PropertyEditPage rimosso perché usiamo il dialog modale
import NewPropertyPage from "@/pages/properties/new";
import SharedPropertiesPage from "@/pages/properties/shared/index";
import SharedPropertyDetailPage from "@/pages/properties/shared/[id]";
import NewSharedPropertyPage from "@/pages/properties/shared/new";
import SimpleNewClientPage from "@/pages/clients/simple-new";
import DirectNewClientPage from "@/pages/clients/direct-new";
import AppointmentsPage from "@/pages/appointments/index";
import CommunicationsPage from "@/pages/communications/index";
import CommunicationDetailPage from "@/pages/communications/[id]";
import CommunicationEditPage from "@/pages/communications/[id]/edit";
import CommunicationNewPage from "@/pages/communications/new";
import WhatsAppSenderPage from "@/pages/communications/whatsapp";
import TasksPage from "@/pages/tasks/index";
import AnalyticsPage from "@/pages/analytics/index";
import SearchHeatmapPage from "@/pages/analytics/search-heatmap";
import DemandAnalysisPage from "@/pages/analytics/demand-analysis";
import WhatsAppTestPage from "@/pages/testing/whatsapp";
import AssistentePage from "@/pages/assistente/index";
import AppointmentConfirmationsPage from "@/pages/appointment-confirmations";
import CalendarPage from "@/pages/calendar";
import GoogleOAuthPage from "@/pages/google-oauth";
import EmailProcessorPage from "@/pages/email-processor";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/new" component={ClientsByTypePage} />
      <Route path="/clients/direct-new" component={DirectNewClientPage} />
      <Route path="/clients/edit/:id" component={ClientsByTypePage} />
      <Route path="/clients/modify/:id" component={ClientsByTypePage} />
      <Route path="/clients/type/:type" component={ClientsByTypePage} />
      <Route path="/clients/:id/search" component={ClientPropertySearchPage} />
      <Route path="/clients/:id" component={ClientDetailPage} />
      <Route path="/properties" component={PropertiesPage} />
      <Route path="/properties/new" component={NewPropertyPage} />
      <Route path="/properties/shared" component={SharedPropertiesPage} />
      <Route path="/properties/shared/new" component={NewSharedPropertyPage} />
      <Route path="/properties/shared/:id" component={SharedPropertyDetailPage} />
      {/* Rotta edit rimossa perché ora utilizziamo il dialog modale */}
      <Route path="/properties/:id" component={PropertyDetailPage} />
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/appointment-confirmations" component={AppointmentConfirmationsPage} />
      <Route path="/communications" component={CommunicationsPage} />
      <Route path="/communications/new" component={CommunicationNewPage} />
      <Route path="/communications/whatsapp" component={WhatsAppSenderPage} />
      <Route path="/communications/:id/edit" component={CommunicationEditPage} />
      <Route path="/communications/:id" component={CommunicationDetailPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/analytics/search-heatmap" component={SearchHeatmapPage} />
      <Route path="/analytics/demand-analysis" component={DemandAnalysisPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/google-oauth" component={GoogleOAuthPage} />
      <Route path="/assistente" component={AssistentePage} />
      <Route path="/email-processor" component={EmailProcessorPage} />
      <Route path="/testing/whatsapp" component={WhatsAppTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="realestate-crm-theme">
        <TooltipProvider>
          <AddressAutocompleteProvider>
            <Toaster />
            <AppLayout>
              <Router />
            </AppLayout>
          </AddressAutocompleteProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
