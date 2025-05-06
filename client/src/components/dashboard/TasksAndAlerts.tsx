import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Task } from "@/types";

export default function TasksAndAlerts() {
  // In a real app, we would fetch this data from the API
  // For this prototype, we'll use some sample data
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      // This would be replaced with a real API call
      return [
        {
          id: 1,
          type: "noResponse",
          title: "Mancata risposta",
          description: "Dott. Ferrari non ha visualizzato l'appartamento in Via Roma.",
          createdAt: "2023-09-20T10:30:00Z",
          dueDate: "2023-09-20T18:30:00Z",
          client: {
            id: 101,
            firstName: "Ferrari",
            lastName: "Dott.",
            phone: "+391234567890"
          }
        },
        {
          id: 2,
          type: "followUp",
          title: "Follow-up cliente",
          description: "Contattare Sig.ra Bianchi per feedback dopo la visita.",
          createdAt: "2023-09-20T09:15:00Z",
          dueDate: "2023-09-20T17:00:00Z",
          client: {
            id: 102,
            firstName: "Bianchi",
            lastName: "Sig.ra",
            phone: "+391234567891"
          }
        },
        {
          id: 3,
          type: "birthday",
          title: "Compleanno cliente",
          description: "Compleanno di Marco Verdi, inviare auguri personalizzati.",
          createdAt: "2023-09-19T14:00:00Z",
          dueDate: "2023-09-21T10:00:00Z",
          client: {
            id: 103,
            firstName: "Marco",
            lastName: "Verdi",
            phone: "+391234567892"
          }
        }
      ] as Task[];
    }
  });

  if (isLoading) {
    return <TasksAndAlertsSkeleton />;
  }

  const renderTaskIcon = (type: string) => {
    switch (type) {
      case "noResponse":
        return (
          <span className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
            <i className="fas fa-exclamation-circle"></i>
          </span>
        );
      case "followUp":
        return (
          <span className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <i className="fas fa-clock"></i>
          </span>
        );
      case "birthday":
        return (
          <span className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <i className="fas fa-birthday-cake"></i>
          </span>
        );
      default:
        return (
          <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <i className="fas fa-bell"></i>
          </span>
        );
    }
  };

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    const diffDays = Math.round(diffHours / 24);

    if (diffHours < 1) return "meno di un'ora fa";
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays === 1) return "ieri";
    if (diffDays < 7) return `${diffDays} giorni fa`;
    return date.toLocaleDateString("it-IT");
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg text-gray-800">Task e Alert</h2>
        <a href="/tasks" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Vedi tutti</a>
      </div>
      
      <div className="divide-y divide-gray-200">
        {tasks?.map((task) => (
          <div key={task.id} className="px-5 py-4 flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              {renderTaskIcon(task.type)}
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                <p className="text-xs text-gray-500">{getRelativeTime(task.createdAt)}</p>
              </div>
              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
              
              {task.type === "noResponse" && (
                <div className="mt-2 flex space-x-2">
                  <Button size="sm" className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md">
                    <i className="fas fa-phone-alt mr-1"></i> Chiama
                  </Button>
                  <Button size="sm" className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md">
                    <i className="fab fa-whatsapp mr-1"></i> WhatsApp
                  </Button>
                </div>
              )}
              
              {task.type === "followUp" && (
                <div className="mt-2 flex space-x-2">
                  <Button variant="outline" size="sm" className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-md">
                    Posticipa
                  </Button>
                  <Button size="sm" className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md">
                    Completato
                  </Button>
                </div>
              )}
              
              {task.type === "birthday" && (
                <div className="mt-2 flex space-x-2">
                  <Button size="sm" className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md">
                    <i className="fab fa-whatsapp mr-1"></i> Invia Auguri
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksAndAlertsSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      <div className="divide-y divide-gray-200">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-5 py-4 flex items-start">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full mb-3" />
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
