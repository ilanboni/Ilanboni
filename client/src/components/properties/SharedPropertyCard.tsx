import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  ExternalLink, 
  MapPin, 
  Euro, 
  Maximize2,
  Users,
  ListTodo,
  GitBranch,
  Trophy,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Agency {
  name: string;
  link: string;
  sourcePropertyId?: number;
}

interface SharedProperty {
  id: number;
  address: string;
  city?: string | null;
  size?: number | null;
  price?: number | null;
  type?: string | null;
  floor?: string | null;
  rating?: number | null;
  stage?: string | null;
  stageResult?: string | null;
  isAcquired?: boolean | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerNotes?: string | null;
  agencies?: Agency[] | null;
  agency1Name?: string | null;
  agency1Link?: string | null;
  agency2Name?: string | null;
  agency2Link?: string | null;
  agency3Name?: string | null;
  agency3Link?: string | null;
}

interface Task {
  id: number;
  title: string;
  description?: string | null;
  dueDate: string;
  status: string;
  priority?: number | null;
}

interface MatchedClient {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  matchScore?: number;
}

interface SharedPropertyCardProps {
  property: SharedProperty;
  tasks?: Task[];
  matchedClients?: MatchedClient[];
  onStageChange?: (propertyId: number, newStage: string) => void;
  onAcquire?: (propertyId: number) => void;
  onCreateTask?: (propertyId: number) => void;
}

export function SharedPropertyCard({ property, tasks = [], matchedClients = [], onStageChange, onAcquire, onCreateTask }: SharedPropertyCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Combina agenzie da campi legacy e nuovo array JSONB
  const getAllAgencies = (): Agency[] => {
    const agencies: Agency[] = [];
    
    // Aggiungi agenzie da JSONB se presente
    if (property.agencies && Array.isArray(property.agencies)) {
      agencies.push(...property.agencies);
    }
    
    // Aggiungi agenzie dai campi legacy (se non già presenti)
    if (property.agency1Name) {
      agencies.push({ name: property.agency1Name, link: property.agency1Link || '' });
    }
    if (property.agency2Name) {
      agencies.push({ name: property.agency2Name, link: property.agency2Link || '' });
    }
    if (property.agency3Name) {
      agencies.push({ name: property.agency3Name, link: property.agency3Link || '' });
    }
    
    return agencies;
  };

  const agencies = getAllAgencies();
  const agencyCount = agencies.length;

  const formatPrice = (price?: number | null) => {
    if (!price) return 'N/D';
    return new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const getStageLabel = (stage?: string | null) => {
    const stages: Record<string, string> = {
      'address_found': 'Indirizzo Trovato',
      'owner_found': 'Proprietario Trovato',
      'owner_contact_found': 'Contatti Trovati',
      'owner_contacted': 'Proprietario Contattato',
      'result': 'Completato'
    };
    return stages[stage || ''] || stage || 'N/D';
  };

  const getStageVariant = (stage?: string | null) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      'address_found': 'outline',
      'owner_found': 'secondary',
      'owner_contact_found': 'secondary',
      'owner_contacted': 'default',
      'result': 'default'
    };
    return variants[stage || ''] || 'outline';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4" data-testid={`card-shared-property-${property.id}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {property.address}
                    {property.isAcquired && (
                      <Badge variant="default" className="bg-green-600">
                        <Trophy className="h-3 w-3 mr-1" />
                        Acquisito
                      </Badge>
                    )}
                    <Badge variant="outline" data-testid={`badge-agency-count-${property.id}`}>
                      {agencyCount} {agencyCount === 1 ? 'Agenzia' : 'Agenzie'}
                    </Badge>
                    <Badge variant={getStageVariant(property.stage)}>
                      {getStageLabel(property.stage)}
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    {property.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {property.city}
                      </span>
                    )}
                    {property.size && (
                      <span className="flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" />
                        {property.size} m²
                      </span>
                    )}
                    {property.price && (
                      <span className="flex items-center gap-1">
                        <Euro className="h-3 w-3" />
                        {formatPrice(property.price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-4">
            <Tabs defaultValue="dettagli" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="dettagli" data-testid={`tab-dettagli-${property.id}`}>Dettagli</TabsTrigger>
                <TabsTrigger value="agenzie" data-testid={`tab-agenzie-${property.id}`}>
                  Agenzie ({agencyCount})
                </TabsTrigger>
                <TabsTrigger value="pipeline" data-testid={`tab-pipeline-${property.id}`}>
                  <GitBranch className="h-4 w-4 mr-1" />
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="attivita" data-testid={`tab-attivita-${property.id}`}>
                  <ListTodo className="h-4 w-4 mr-1" />
                  Attività
                </TabsTrigger>
                <TabsTrigger value="clienti" data-testid={`tab-clienti-${property.id}`}>
                  <Users className="h-4 w-4 mr-1" />
                  Clienti
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dettagli" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Indirizzo</label>
                    <p className="text-sm text-gray-900">{property.address}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Città</label>
                    <p className="text-sm text-gray-900">{property.city || 'N/D'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tipologia</label>
                    <p className="text-sm text-gray-900">{property.type || 'N/D'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Piano</label>
                    <p className="text-sm text-gray-900">{property.floor || 'N/D'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Dimensione</label>
                    <p className="text-sm text-gray-900">{property.size ? `${property.size} m²` : 'N/D'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Prezzo</label>
                    <p className="text-sm text-gray-900">{formatPrice(property.price)}</p>
                  </div>
                </div>

                {property.ownerName && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Informazioni Proprietario</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Nome</label>
                        <p className="text-sm">{property.ownerName}</p>
                      </div>
                      {property.ownerPhone && (
                        <div>
                          <label className="text-xs font-medium text-gray-600">Telefono</label>
                          <p className="text-sm">{property.ownerPhone}</p>
                        </div>
                      )}
                      {property.ownerEmail && (
                        <div>
                          <label className="text-xs font-medium text-gray-600">Email</label>
                          <p className="text-sm">{property.ownerEmail}</p>
                        </div>
                      )}
                      {property.ownerNotes && (
                        <div>
                          <label className="text-xs font-medium text-gray-600">Note</label>
                          <p className="text-sm">{property.ownerNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="agenzie" className="space-y-3">
                {agencies.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Nessuna agenzia trovata
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground mb-4">
                      Questo immobile è gestito da <strong>{agencyCount}</strong> {agencyCount === 1 ? 'agenzia' : 'agenzie'} diverse
                    </div>
                    <div className="space-y-2">
                      {agencies.map((agency, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          data-testid={`agency-item-${index}`}
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <span className="font-medium">{agency.name || 'Agenzia Sconosciuta'}</span>
                          </div>
                          {agency.link && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              asChild
                              data-testid={`button-view-agency-${index}`}
                            >
                              <a href={agency.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Vedi Annuncio
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="pipeline" className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Traccia il progresso verso l'acquisizione dell'esclusiva
                </div>

                {/* Pipeline visualization */}
                <div className="relative">
                  <div className="flex items-center justify-between">
                    {/* Stage 1: Indirizzo Trovato */}
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        property.stage === 'address_found' || property.stage === 'owner_found' || property.stage === 'owner_contact_found' || property.stage === 'owner_contacted' || property.stage === 'result'
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <span className="text-xs mt-2 text-center">Indirizzo<br />Trovato</span>
                    </div>

                    {/* Connector */}
                    <div className={`h-1 flex-1 ${
                      property.stage === 'owner_found' || property.stage === 'owner_contact_found' || property.stage === 'owner_contacted' || property.stage === 'result'
                        ? 'bg-blue-600' 
                        : 'bg-gray-200'
                    }`} />

                    {/* Stage 2: Proprietario Trovato */}
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        property.stage === 'owner_found' || property.stage === 'owner_contact_found' || property.stage === 'owner_contacted' || property.stage === 'result'
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        <Users className="h-5 w-5" />
                      </div>
                      <span className="text-xs mt-2 text-center">Proprietario<br />Trovato</span>
                    </div>

                    {/* Connector */}
                    <div className={`h-1 flex-1 ${
                      property.stage === 'owner_contact_found' || property.stage === 'owner_contacted' || property.stage === 'result'
                        ? 'bg-blue-600' 
                        : 'bg-gray-200'
                    }`} />

                    {/* Stage 3: Contatti Trovati */}
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        property.stage === 'owner_contact_found' || property.stage === 'owner_contacted' || property.stage === 'result'
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        <ListTodo className="h-5 w-5" />
                      </div>
                      <span className="text-xs mt-2 text-center">Contatti<br />Trovati</span>
                    </div>

                    {/* Connector */}
                    <div className={`h-1 flex-1 ${
                      property.stage === 'owner_contacted' || property.stage === 'result'
                        ? 'bg-blue-600' 
                        : 'bg-gray-200'
                    }`} />

                    {/* Stage 4: Proprietario Contattato */}
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        property.stage === 'owner_contacted' || property.stage === 'result'
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <span className="text-xs mt-2 text-center">Proprietario<br />Contattato</span>
                    </div>

                    {/* Connector */}
                    <div className={`h-1 flex-1 ${
                      property.stage === 'result'
                        ? 'bg-green-600' 
                        : 'bg-gray-200'
                    }`} />

                    {/* Stage 5: Completato */}
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        property.stage === 'result'
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        <Trophy className="h-5 w-5" />
                      </div>
                      <span className="text-xs mt-2 text-center">Completato</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-6">
                  {property.stage !== 'result' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const stages = ['address_found', 'owner_found', 'owner_contact_found', 'owner_contacted', 'result'];
                        const currentIndex = stages.indexOf(property.stage || 'address_found');
                        if (currentIndex < stages.length - 1 && onStageChange) {
                          onStageChange(property.id, stages[currentIndex + 1]);
                        }
                      }}
                      data-testid={`button-advance-stage-${property.id}`}
                    >
                      Avanza Stage
                    </Button>
                  )}
                  
                  {property.stage === 'result' && property.stageResult && (
                    <Badge variant={
                      property.stageResult === 'acquired' ? 'default' : 
                      property.stageResult === 'rejected' ? 'destructive' : 
                      'outline'
                    }>
                      Risultato: {
                        property.stageResult === 'acquired' ? 'Acquisito' :
                        property.stageResult === 'rejected' ? 'Rifiutato' :
                        'In Sospeso'
                      }
                    </Badge>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="attivita" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    Attività per acquisire l'esclusiva
                  </div>
                  {onCreateTask && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onCreateTask(property.id)}
                      data-testid={`button-create-task-${property.id}`}
                    >
                      <ListTodo className="h-4 w-4 mr-1" />
                      Nuova Attività
                    </Button>
                  )}
                </div>

                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nessuna attività. Crea task per tracciare il progresso verso l'esclusiva.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div 
                        key={task.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        data-testid={`task-item-${task.id}`}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge variant={task.status === 'completed' ? 'default' : 'outline'} className="text-xs">
                              {task.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Scadenza: {new Date(task.dueDate).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="clienti" className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Clienti che cercano immobili simili a questo
                </div>

                {matchedClients.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nessun cliente interessato trovato. Il matching automatico verrà eseguito quando l'immobile sarà acquisito.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matchedClients.map((client) => (
                      <div 
                        key={client.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        data-testid={`client-item-${client.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-blue-600" />
                          <div>
                            <div className="font-medium">{client.firstName} {client.lastName}</div>
                            <div className="text-xs text-muted-foreground">{client.phone}</div>
                          </div>
                        </div>
                        {client.matchScore && (
                          <Badge variant="outline">
                            Match: {client.matchScore}%
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Azione principale: Immobile Acquisito */}
            {!property.isAcquired && property.stage === 'owner_contacted' && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-green-900">Pronto per l'acquisizione</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Hai contattato il proprietario. Se hai ottenuto l'esclusiva, clicca qui per acquisire l'immobile e iniziare il matching con i clienti interessati.
                    </p>
                  </div>
                  <Button 
                    variant="default" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => onAcquire && onAcquire(property.id)}
                    data-testid={`button-acquire-${property.id}`}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Immobile Acquisito
                  </Button>
                </div>
              </div>
            )}

            {property.isAcquired && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900">Immobile Acquisito!</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Questo immobile è stato acquisito. Il matching automatico con i clienti interessati è stato avviato.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Pulsante Vedi Dettagli */}
            <div className="mt-6">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                asChild
                data-testid={`button-view-details-${property.id}`}
              >
                <Link href={`/properties/shared/${property.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Vedi Dettagli Completi
                </Link>
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
