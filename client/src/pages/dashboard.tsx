import { useEffect } from "react";
import StatsOverview from "@/components/dashboard/StatsOverview";
import AppointmentsList from "@/components/dashboard/AppointmentsList";
import PropertyMatchingPanel from "@/components/dashboard/PropertyMatchingPanel";
import MapVisualization from "@/components/dashboard/MapVisualization";
import TasksAndAlerts from "@/components/dashboard/TasksAndAlerts";
import RecentClients from "@/components/dashboard/RecentClients";
import MarketAnalysis from "@/components/dashboard/MarketAnalysis";
import SearchAnalytics from "@/components/dashboard/SearchAnalytics";
import SharedPropertiesRanking from "@/components/dashboard/SharedPropertiesRanking";
import WhatsAppSender from "@/components/dashboard/WhatsAppSender";
import WhatsAppReminders from "@/components/dashboard/WhatsAppReminders";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Helmet } from "react-helmet";

export default function Dashboard() {
  const { toast } = useToast();
  
  // This would normally fetch data from the server
  // For now, we're using the components which have mock data
  
  return (
    <>
      <Helmet>
        <title>Dashboard | RealEstate CRM</title>
        <meta name="description" content="Panoramica delle attività e delle statistiche del sistema gestionale immobiliare" />
      </Helmet>
      
      {/* Page Title and Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Panoramica delle attività e delle statistiche</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <Link href="/clients/new">
            <Button>
              <i className="fas fa-plus mr-2"></i>
              Nuovo Cliente
            </Button>
          </Link>
          <Link href="/properties/new">
            <Button variant="secondary">
              <i className="fas fa-plus mr-2"></i>
              Nuovo Immobile
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Stats Cards */}
      <StatsOverview />
      
      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Appointments */}
          <AppointmentsList />
          
          {/* Property Matching */}
          <PropertyMatchingPanel />
          
          {/* Map area with active polygons */}
          <MapVisualization />
          
          {/* Search Analytics - New Component */}
          <SearchAnalytics />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* WhatsApp Reminders */}
          <WhatsAppReminders />
          
          {/* WhatsApp Sender */}
          <WhatsAppSender />
          
          {/* Tasks and Alerts */}
          <TasksAndAlerts />
          
          {/* Shared Properties Ranking - New Component */}
          <SharedPropertiesRanking />
          
          {/* Recent clients */}
          <RecentClients />
          
          {/* Market Analysis */}
          <MarketAnalysis />
        </div>
      </div>
    </>
  );
}
