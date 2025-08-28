import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Target, TrendingUp, CheckCircle, Clock } from "lucide-react";

interface DailyStats {
  messagesSent: number;
  responsesReceived: number;
  appointmentsBooked: number;
  newClients: number;
}

export default function DailyGoals() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's statistics
  const { data: dailyStats, isLoading } = useQuery<DailyStats>({
    queryKey: ['/api/analytics/daily-stats'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const goals = {
    messages: 10,
    responses: 3,
    appointments: 1,
    newClients: 2
  };

  const stats = dailyStats || {
    messagesSent: 0,
    responsesReceived: 0,
    appointmentsBooked: 0,
    newClients: 0
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getStatusBadge = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return <Badge className="bg-green-100 text-green-700">Completato</Badge>;
    if (percentage >= 70) return <Badge className="bg-yellow-100 text-yellow-700">In corso</Badge>;
    return <Badge className="bg-blue-100 text-blue-700">Da completare</Badge>;
  };

  const today = currentTime.toLocaleDateString('it-IT', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Obiettivi Giornalieri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          Obiettivi Giornalieri
        </CardTitle>
        <p className="text-sm text-gray-600 capitalize">{today}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Messaggi Inviati */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Messaggi Inviati</span>
            {getStatusBadge(stats.messagesSent, goals.messages)}
          </div>
          <div className="flex items-center gap-3">
            <Progress 
              value={(stats.messagesSent / goals.messages) * 100} 
              className="flex-1"
              indicatorClassName={getProgressColor(stats.messagesSent, goals.messages)}
            />
            <span className="text-sm font-bold min-w-0">
              {stats.messagesSent}/{goals.messages}
            </span>
          </div>
        </div>

        {/* Risposte Ricevute */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Risposte Ricevute</span>
            {getStatusBadge(stats.responsesReceived, goals.responses)}
          </div>
          <div className="flex items-center gap-3">
            <Progress 
              value={(stats.responsesReceived / goals.responses) * 100} 
              className="flex-1"
              indicatorClassName={getProgressColor(stats.responsesReceived, goals.responses)}
            />
            <span className="text-sm font-bold min-w-0">
              {stats.responsesReceived}/{goals.responses}
            </span>
          </div>
        </div>

        {/* Appuntamenti Prenotati */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Appuntamenti Prenotati</span>
            {getStatusBadge(stats.appointmentsBooked, goals.appointments)}
          </div>
          <div className="flex items-center gap-3">
            <Progress 
              value={(stats.appointmentsBooked / goals.appointments) * 100} 
              className="flex-1"
              indicatorClassName={getProgressColor(stats.appointmentsBooked, goals.appointments)}
            />
            <span className="text-sm font-bold min-w-0">
              {stats.appointmentsBooked}/{goals.appointments}
            </span>
          </div>
        </div>

        {/* Nuovi Clienti */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nuovi Clienti</span>
            {getStatusBadge(stats.newClients, goals.newClients)}
          </div>
          <div className="flex items-center gap-3">
            <Progress 
              value={(stats.newClients / goals.newClients) * 100} 
              className="flex-1"
              indicatorClassName={getProgressColor(stats.newClients, goals.newClients)}
            />
            <span className="text-sm font-bold min-w-0">
              {stats.newClients}/{goals.newClients}
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Progresso Giornaliero
            </span>
            <span className="font-semibold">
              {Math.round(((stats.messagesSent + stats.responsesReceived + stats.appointmentsBooked + stats.newClients) / 
              (goals.messages + goals.responses + goals.appointments + goals.newClients)) * 100)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}