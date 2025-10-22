import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Clock, Phone, Mail, MessageSquare, MapPin, Euro, Maximize2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Task {
  id: number;
  type: string;
  title: string;
  description: string;
  priority: number;
  dueDate: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  action: string;
  target: string;
  notes: string;
  client?: any;
  property?: any;
  sharedProperty?: any;
  contact?: any;
}

interface TodayData {
  tasks: Task[];
  count: number;
  date: string;
}

function getPriorityColor(priority: number): string {
  if (priority >= 90) return "text-red-600 bg-red-50";
  if (priority >= 70) return "text-orange-600 bg-orange-50";
  return "text-blue-600 bg-blue-50";
}

function getPriorityLabel(priority: number): string {
  if (priority >= 90) return "URGENTE";
  if (priority >= 70) return "ALTA";
  if (priority >= 50) return "MEDIA";
  return "BASSA";
}

function TaskCard({ task }: { task: Task }) {
  const handleComplete = async () => {
    try {
      await apiRequest(`/api/tasks/${task.id}/complete`, {
        method: "PATCH"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/today"] });
    } catch (error) {
      console.error("Errore completamento task:", error);
    }
  };

  const handleSkip = async () => {
    try {
      await apiRequest(`/api/tasks/${task.id}/skip`, {
        method: "PATCH"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/today"] });
    } catch (error) {
      console.error("Errore skip task:", error);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getPriorityColor(task.priority)}>
                {getPriorityLabel(task.priority)}
              </Badge>
              <Badge variant="outline">{task.type}</Badge>
            </div>
            <CardTitle className="text-lg">{task.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {task.description && (
          <p className="text-sm text-gray-600 mb-3 whitespace-pre-line">
            {task.description}
          </p>
        )}
        
        <div className="space-y-2 mb-4">
          {task.action && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Azione:</span>
              <span>{task.action}</span>
            </div>
          )}
          
          {task.contactPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-green-500" />
              <a href={`tel:${task.contactPhone}`} className="text-blue-600 hover:underline">
                {task.contactPhone}
              </a>
            </div>
          )}
          
          {task.contactEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-purple-500" />
              <a href={`mailto:${task.contactEmail}`} className="text-blue-600 hover:underline">
                {task.contactEmail}
              </a>
            </div>
          )}
          
          {task.sharedProperty && (
            <div className="border-t pt-2 mt-2">
              <div className="flex items-center gap-2 text-sm mb-1">
                <MapPin className="h-4 w-4 text-red-500" />
                <span className="font-medium">{task.sharedProperty.address}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {task.sharedProperty.price && (
                  <div className="flex items-center gap-1">
                    <Euro className="h-3 w-3" />
                    <span>{task.sharedProperty.price.toLocaleString()}</span>
                  </div>
                )}
                {task.sharedProperty.size && (
                  <div className="flex items-center gap-1">
                    <Maximize2 className="h-3 w-3" />
                    <span>{task.sharedProperty.size}mq</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleComplete} 
            className="flex-1"
            data-testid={`button-complete-${task.id}`}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Completa
          </Button>
          <Button 
            onClick={handleSkip} 
            variant="outline"
            data-testid={`button-skip-${task.id}`}
          >
            Salta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SecretaryDashboard() {
  const { data, isLoading, error } = useQuery<TodayData>({
    queryKey: ["/api/today"]
  });

  const handleGenerateTasks = async () => {
    try {
      await apiRequest("/api/secretary/generate-tasks", {
        method: "POST"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/today"] });
    } catch (error) {
      console.error("Errore generazione task:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">Errore durante il caricamento dei task</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Segretaria</h1>
          <p className="text-gray-600 mt-1">
            Task prioritari del {new Date().toLocaleDateString('it-IT')}
          </p>
        </div>
        <Button 
          onClick={handleGenerateTasks}
          data-testid="button-generate-tasks"
        >
          <Clock className="h-4 w-4 mr-2" />
          Genera Task Automatici
        </Button>
      </div>

      {data && data.tasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nessun task prioritario</h3>
            <p className="text-gray-600">
              Tutti i task sono stati completati! Puoi generare nuovi task automatici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Task Totali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data?.count || 0}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Urgenti
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">
                  {data?.tasks.filter(t => t.priority >= 90).length || 0}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Alta Priorità
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600">
                  {data?.tasks.filter(t => t.priority >= 70 && t.priority < 90).length || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
