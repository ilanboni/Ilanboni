import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MessagePerformance {
  messageType: string;
  template: string;
  sent: number;
  responses: number;
  responseRate: number;
  avgResponseTime: number; // in hours
  sentiment: 'positive' | 'neutral' | 'negative';
  recommendation: string;
}

interface AIInsights {
  topPerforming: MessagePerformance[];
  underPerforming: MessagePerformance[];
  recommendations: string[];
  overallTrend: 'improving' | 'stable' | 'declining';
  lastAnalyzed: string;
}

export default function AIPerformanceInsights() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: insights, isLoading } = useQuery<AIInsights>({
    queryKey: ['/api/analytics/ai-insights'],
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
  });

  const analyzePerformanceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/analytics/ai-insights/analyze', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Analisi fallita');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/ai-insights'] });
      toast({
        title: "Analisi completata",
        description: "L'IA ha aggiornato le raccomandazioni sui messaggi"
      });
    },
    onError: () => {
      toast({
        title: "Errore nell'analisi",
        description: "Riprova più tardi",
        variant: "destructive"
      });
    }
  });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await analyzePerformanceMutation.mutateAsync();
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Mock data for demo - in real app this would come from AI analysis
  const mockInsights: AIInsights = insights || {
    topPerforming: [
      {
        messageType: 'Follow-up Personalizzato',
        template: 'Messaggio con video di presentazione',
        sent: 12,
        responses: 5,
        responseRate: 41.7,
        avgResponseTime: 2.3,
        sentiment: 'positive',
        recommendation: 'Ottima performance. Usa questo formato più spesso.'
      },
      {
        messageType: 'Mail Merge Diretto',
        template: 'Riferimento vendita recente + video',
        sent: 15,
        responses: 4,
        responseRate: 26.7,
        avgResponseTime: 4.1,
        sentiment: 'positive',
        recommendation: 'Buoni risultati. Considera di personalizzare di più.'
      }
    ],
    underPerforming: [
      {
        messageType: 'Messaggio Generico',
        template: 'Template standard senza personalizzazione',
        sent: 20,
        responses: 2,
        responseRate: 10.0,
        avgResponseTime: 12.5,
        sentiment: 'neutral',
        recommendation: 'Troppo generico. Aggiungi elementi di personalizzazione.'
      }
    ],
    recommendations: [
      '🎯 I messaggi con video di presentazione hanno 65% più risposte',
      '📱 I messaggi inviati tra le 9:00 e le 11:00 ricevono più risposte',
      '✍️ Personalizzare con il nome della zona aumenta il tasso di risposta del 23%',
      '🏡 Citare vendite recenti nella stessa zona migliora la credibilità',
      '⏰ I follow-up entro 48h hanno il 40% di probabilità in più di risposta'
    ],
    overallTrend: 'improving',
    lastAnalyzed: new Date().toISOString()
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return "bg-green-100 text-green-700";
      case 'negative': return "bg-red-100 text-red-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-20 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          AI Performance Insights
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {getTrendIcon(mockInsights.overallTrend)}
            <span className="capitalize">{mockInsights.overallTrend}</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analizzando...' : 'Aggiorna'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Performing Messages */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Messaggi più Performanti
          </h4>
          <div className="space-y-3">
            {mockInsights.topPerforming.map((msg, index) => (
              <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{msg.messageType}</span>
                  <Badge className="bg-green-100 text-green-700">
                    {msg.responseRate.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 mb-2">{msg.template}</p>
                <p className="text-xs text-green-700">{msg.recommendation}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Under Performing Messages */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Da Migliorare
          </h4>
          <div className="space-y-3">
            {mockInsights.underPerforming.map((msg, index) => (
              <div key={index} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{msg.messageType}</span>
                  <Badge className="bg-red-100 text-red-700">
                    {msg.responseRate.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 mb-2">{msg.template}</p>
                <p className="text-xs text-red-700">{msg.recommendation}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Raccomandazioni AI
          </h4>
          <div className="space-y-2">
            {mockInsights.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded text-xs">
                <span className="mt-0.5">💡</span>
                <span className="text-blue-700">{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Last Analysis */}
        <div className="pt-4 border-t text-xs text-gray-500 text-center">
          Ultima analisi: {new Date(mockInsights.lastAnalyzed).toLocaleString('it-IT')}
        </div>
      </CardContent>
    </Card>
  );
}