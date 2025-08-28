import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, MessageSquare, Users, Calendar } from "lucide-react";

interface AnalyticsData {
  messagesByType: Array<{
    type: string;
    sent: number;
    responses: number;
    responseRate: number;
  }>;
  weeklyTrends: Array<{
    day: string;
    messages: number;
    responses: number;
  }>;
  responseRates: {
    overall: number;
    mailMerge: number;
    manual: number;
    followUp: number;
  };
}

export default function PerformanceAnalytics() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics/performance'],
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Analytics Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const mockData = analytics || {
    messagesByType: [
      { type: 'Mail Merge', sent: 15, responses: 4, responseRate: 26.7 },
      { type: 'Manuali', sent: 8, responses: 3, responseRate: 37.5 },
      { type: 'Follow-up', sent: 5, responses: 2, responseRate: 40.0 }
    ],
    weeklyTrends: [
      { day: 'Lun', messages: 8, responses: 2 },
      { day: 'Mar', messages: 12, responses: 3 },
      { day: 'Mer', messages: 10, responses: 4 },
      { day: 'Gio', messages: 15, responses: 5 },
      { day: 'Ven', messages: 18, responses: 6 },
      { day: 'Sab', messages: 6, responses: 1 },
      { day: 'Dom', messages: 3, responses: 1 }
    ],
    responseRates: {
      overall: 31.4,
      mailMerge: 26.7,
      manual: 37.5,
      followUp: 40.0
    }
  };

  const getResponseRateColor = (rate: number) => {
    if (rate >= 35) return "text-green-600 bg-green-100";
    if (rate >= 25) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Analytics Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Response Rates Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {mockData.responseRates.overall.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Tasso Risposta Globale</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {mockData.messagesByType.reduce((sum, item) => sum + item.sent, 0)}
            </div>
            <div className="text-sm text-gray-600">Messaggi Inviati</div>
          </div>
        </div>

        {/* Weekly Trends Chart */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Trend Settimanale</h4>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={mockData.weeklyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="messages" fill="#3b82f6" name="Messaggi" />
              <Bar dataKey="responses" fill="#10b981" name="Risposte" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Message Types Performance */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Performance per Tipo</h4>
          <div className="space-y-3">
            {mockData.messagesByType.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{item.type}</div>
                  <div className="text-xs text-gray-600">
                    {item.sent} inviati • {item.responses} risposte
                  </div>
                </div>
                <Badge className={`text-xs ${getResponseRateColor(item.responseRate)}`}>
                  {item.responseRate.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t">
          <div className="text-center">
            <MessageSquare className="h-4 w-4 mx-auto text-blue-500 mb-1" />
            <div className="text-xs text-gray-600">Oggi</div>
            <div className="text-sm font-semibold">
              {mockData.weeklyTrends[mockData.weeklyTrends.length - 1]?.messages || 0}
            </div>
          </div>
          <div className="text-center">
            <Users className="h-4 w-4 mx-auto text-green-500 mb-1" />
            <div className="text-xs text-gray-600">Risposte</div>
            <div className="text-sm font-semibold">
              {mockData.weeklyTrends[mockData.weeklyTrends.length - 1]?.responses || 0}
            </div>
          </div>
          <div className="text-center">
            <Calendar className="h-4 w-4 mx-auto text-purple-500 mb-1" />
            <div className="text-xs text-gray-600">Media</div>
            <div className="text-sm font-semibold">
              {(mockData.weeklyTrends.reduce((sum, day) => sum + day.messages, 0) / 7).toFixed(0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}