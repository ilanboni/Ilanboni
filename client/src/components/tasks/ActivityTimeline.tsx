import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Calendar, 
  Phone, 
  Users, 
  Mail, 
  Home, 
  FileText, 
  Search,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import type { TaskWithClient } from "@shared/schema";

interface ActivityTimelineProps {
  clientId?: number;
  propertyId?: number;
  sharedPropertyId?: number;
}

const taskTypeConfig = {
  followUp: { label: "Follow-up", icon: Calendar, color: "bg-blue-500" },
  call: { label: "Chiamata", icon: Phone, color: "bg-green-500" },
  meeting: { label: "Incontro", icon: Users, color: "bg-purple-500" },
  email: { label: "Email", icon: Mail, color: "bg-orange-500" },
  viewing: { label: "Visita immobile", icon: Home, color: "bg-indigo-500" },
  document: { label: "Documenti", icon: FileText, color: "bg-gray-500" },
  search: { label: "Ricerca", icon: Search, color: "bg-yellow-500" },
  other: { label: "Altro", icon: MoreHorizontal, color: "bg-slate-500" },
};

const statusConfig = {
  pending: { label: "In attesa", icon: Clock, variant: "secondary" as const },
  completed: { label: "Completata", icon: CheckCircle2, variant: "default" as const },
  cancelled: { label: "Annullata", icon: XCircle, variant: "destructive" as const },
  open: { label: "Aperta", icon: AlertCircle, variant: "outline" as const },
};

const priorityConfig = {
  1: { label: "Bassa", color: "text-green-600" },
  2: { label: "Media", color: "text-yellow-600" },
  3: { label: "Alta", color: "text-red-600" },
};

export function ActivityTimeline({ clientId, propertyId, sharedPropertyId }: ActivityTimelineProps) {
  const [, setLocation] = useLocation();
  
  // Build query URL based on filters
  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (clientId) params.append("clientId", clientId.toString());
    if (propertyId) params.append("propertyId", propertyId.toString());
    if (sharedPropertyId) params.append("sharedPropertyId", sharedPropertyId.toString());
    return `/api/tasks${params.toString() ? `?${params.toString()}` : ""}`;
  }, [clientId, propertyId, sharedPropertyId]);

  const { data: tasks = [], isLoading } = useQuery<TaskWithClient[]>({
    queryKey: [queryUrl],
  });

  // Sort tasks by due date (most recent first)
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nessuna attività trovata</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sortedTasks.map((task) => {
        const typeConfig = taskTypeConfig[task.type as keyof typeof taskTypeConfig] || taskTypeConfig.other;
        const TypeIcon = typeConfig.icon;
        const statusInfo = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
        const StatusIcon = statusInfo.icon;
        const priority = task.priority && task.priority >= 1 && task.priority <= 3 
          ? priorityConfig[task.priority as 1 | 2 | 3] 
          : priorityConfig[2];

        return (
          <Card 
            key={task.id}
            className="hover:shadow-md transition-shadow cursor-pointer group"
            data-testid={`activity-card-${task.id}`}
            onClick={() => setLocation(`/tasks/${task.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Icon column */}
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-10 h-10 rounded-full ${typeConfig.color} flex items-center justify-center text-white`}>
                    <TypeIcon className="h-5 w-5" />
                  </div>
                </div>

                {/* Content column */}
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span className="font-medium">{typeConfig.label}</span>
                        {task.clientFirstName && (
                          <>
                            <span>•</span>
                            <span>{task.clientFirstName} {task.clientLastName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Status and priority badges */}
                    <div className="flex flex-col gap-1 items-end">
                      <Badge variant={statusInfo.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                      <span className={`text-xs font-medium ${priority.color}`}>
                        {priority.label}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {/* Footer row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Scadenza: {format(new Date(task.dueDate), "d MMMM yyyy", { locale: it })}
                      </span>
                    </div>
                    
                    {task.notes && (
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>Note</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
