import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { AppStats } from "@/types";

export default function StatsOverview() {
  const { data: stats, isLoading } = useQuery<AppStats>({
    queryKey: ['/api/stats']
  });

  if (isLoading) {
    return <StatsOverviewSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Clients Card */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Clienti Totali</h2>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalClients || 0}</p>
          </div>
          <div className="p-3 rounded-full bg-blue-100 text-blue-600">
            <i className="fas fa-users"></i>
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-green-500 font-medium flex items-center">
            <i className="fas fa-arrow-up mr-1 text-xs"></i> {stats?.clientsChange || 0}%
          </span>
          <span className="text-gray-400 ml-2">Dall'ultimo mese</span>
        </div>
      </div>
      
      {/* Properties Card */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Immobili in Gestione</h2>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalProperties || 0}</p>
          </div>
          <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
            <i className="fas fa-building"></i>
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-green-500 font-medium flex items-center">
            <i className="fas fa-arrow-up mr-1 text-xs"></i> {stats?.propertiesChange || 0}%
          </span>
          <span className="text-gray-400 ml-2">Dall'ultimo mese</span>
        </div>
      </div>
      
      {/* Appointments Card */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Appuntamenti Odierni</h2>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.todayAppointments || 0}</p>
          </div>
          <div className="p-3 rounded-full bg-amber-100 text-amber-600">
            <i className="fas fa-calendar-check"></i>
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-green-500 font-medium flex items-center">
            <i className="fas fa-arrow-up mr-1 text-xs"></i> {stats?.appointmentsDiff || 0}
          </span>
          <span className="text-gray-400 ml-2">Rispetto a ieri</span>
        </div>
      </div>
      
      {/* Tasks/Alerts Card */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Task Attivi</h2>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.activeTasks || 0}</p>
          </div>
          <div className="p-3 rounded-full bg-red-100 text-red-600">
            <i className="fas fa-tasks"></i>
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-red-500 font-medium flex items-center">
            <i className="fas fa-arrow-up mr-1 text-xs"></i> {stats?.dueTodayTasks || 0}
          </span>
          <span className="text-gray-400 ml-2">Da completare oggi</span>
        </div>
      </div>
    </div>
  );
}

function StatsOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mt-1" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          <div className="mt-4 flex items-center">
            <Skeleton className="h-4 w-16 mr-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
