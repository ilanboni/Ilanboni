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
import MessagesPanel from "@/components/dashboard/MessagesPanel";
import DailyGoals from "@/components/dashboard/DailyGoals";
import PerformanceAnalytics from "@/components/dashboard/PerformanceAnalytics";
import AIPerformanceInsights from "@/components/dashboard/AIPerformanceInsights";
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div className="mb-3 sm:mb-0">
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">Panoramica attività e statistiche</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link href="/clients/direct-new" className="flex-1 sm:flex-none">
            <Button className="w-full tap-target">
              <i className="fas fa-plus mr-1.5 sm:mr-2 text-sm"></i>
              <span className="text-sm">Nuovo Cliente</span>
            </Button>
          </Link>
          <Link href="/properties/new" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full tap-target">
              <i className="fas fa-plus mr-1.5 sm:mr-2 text-sm"></i>
              <span className="text-sm">Immobile</span>
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Stats Cards */}
      <StatsOverview />
      
      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4 lg:space-y-6">
          {/* Today's Appointments */}
          <AppointmentsList />
          
          {/* Property Matching */}
          <PropertyMatchingPanel />
          
          {/* Map area with active polygons */}
          <div className="hidden sm:block">
            <MapVisualization />
          </div>
          
          {/* Search Analytics - New Component */}
          <SearchAnalytics />
        </div>
        
        {/* Right Column */}
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {/* Daily Goals */}
          <DailyGoals />
          
          {/* Performance Analytics */}
          <PerformanceAnalytics />
          
          {/* AI Performance Insights */}
          <AIPerformanceInsights />
          
          {/* Messages Panel */}
          <MessagesPanel />
          
          {/* WhatsApp Sender */}
          <div className="hidden sm:block">
            <WhatsAppSender />
          </div>
          
          {/* Tasks and Alerts */}
          <TasksAndAlerts />
          
          {/* Shared Properties Ranking - New Component */}
          <SharedPropertiesRanking />
          
          {/* Recent clients */}
          <RecentClients />
          
          {/* Market Analysis */}
          <div className="hidden sm:block">
            <MarketAnalysis />
          </div>
        </div>
      </div>
    </>
  );
}
