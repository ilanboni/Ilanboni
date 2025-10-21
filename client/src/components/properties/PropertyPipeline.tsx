import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp,
  MapPin,
  User,
  Phone,
  CheckCircle2,
  Circle,
  Flag
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface PipelineStage {
  stage: string;
  label: string;
  completed: boolean;
  date: string | null;
}

interface PipelineData {
  propertyId: number;
  currentStage: string;
  stages: PipelineStage[];
}

interface PropertyPipelineProps {
  propertyId: number;
}

export default function PropertyPipeline({ propertyId }: PropertyPipelineProps) {
  const { data: pipeline, isLoading } = useQuery<PipelineData>({
    queryKey: [`/api/properties/${propertyId}/pipeline`],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/pipeline`);
      if (!response.ok) throw new Error('Errore caricamento pipeline');
      return response.json();
    },
    enabled: !!propertyId,
  });

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'address_found':
        return <MapPin className="h-4 w-4" />;
      case 'owner_found':
        return <User className="h-4 w-4" />;
      case 'owner_contact_found':
        return <Phone className="h-4 w-4" />;
      case 'owner_contacted':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'result':
        return <Flag className="h-4 w-4" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getStageColor = (stage: string, completed: boolean, isCurrent: boolean) => {
    if (completed) {
      return 'bg-green-500 text-white border-green-600';
    }
    if (isCurrent) {
      return 'bg-blue-500 text-white border-blue-600';
    }
    return 'bg-gray-200 text-gray-500 border-gray-300';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Pipeline Avanzamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Caricamento pipeline...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pipeline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Pipeline Avanzamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Nessuna pipeline disponibile
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Pipeline Avanzamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pipeline.stages.map((stage, index) => {
            const isCurrent = stage.stage === pipeline.currentStage;
            const isCompleted = stage.completed;
            
            return (
              <div 
                key={stage.stage} 
                className="relative"
                data-testid={`pipeline-stage-${stage.stage}`}
              >
                {/* Linea di connessione verticale */}
                {index < pipeline.stages.length - 1 && (
                  <div 
                    className={`absolute left-6 top-12 w-0.5 h-full -mb-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
                
                <div className="flex items-start gap-4">
                  {/* Icona stage */}
                  <div 
                    className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center z-10 ${
                      getStageColor(stage.stage, isCompleted, isCurrent)
                    }`}
                  >
                    {getStageIcon(stage.stage)}
                  </div>
                  
                  {/* Contenuto stage */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stage.label}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          In corso
                        </Badge>
                      )}
                      {isCompleted && !isCurrent && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          Completato
                        </Badge>
                      )}
                    </div>
                    
                    {stage.date && (
                      <div className="text-sm text-gray-500 mt-1">
                        {format(new Date(stage.date), "d MMMM yyyy", { locale: it })}
                      </div>
                    )}
                    
                    {!isCompleted && !isCurrent && (
                      <div className="text-sm text-gray-400 mt-1">
                        Non ancora raggiunto
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
