import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  ExternalLink, 
  MapPin, 
  Euro, 
  Maximize2,
  ChevronDown,
  ChevronUp,
  Star,
  Trash2,
  Eye
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  classification?: 'multiagency' | 'private';
  isFavorite?: boolean | null;
  agencies?: Agency[] | null;
  agency1Name?: string | null;
  agency1Link?: string | null;
  agency2Name?: string | null;
  agency2Link?: string | null;
  agency3Name?: string | null;
  agency3Link?: string | null;
}

interface SimplifiedSharedPropertyCardProps {
  property: SharedProperty;
  onToggleFavorite?: (propertyId: number, isFavorite: boolean) => void;
  onDelete?: (propertyId: number) => void;
}

export function SimplifiedSharedPropertyCard({ 
  property, 
  onToggleFavorite,
  onDelete 
}: SimplifiedSharedPropertyCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  // Get color coding based on classification
  const getClassificationBadge = () => {
    if (property.classification === 'multiagency') {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white" data-testid={`badge-multiagency-${property.id}`}>
          🟡 Multi-Agency
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-green-500 hover:bg-green-600 text-white" data-testid={`badge-private-${property.id}`}>
        🟢 Privato
      </Badge>
    );
  };

  const handleToggleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(property.id, !property.isFavorite);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(property.id);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="mb-3 hover:shadow-md transition-shadow" data-testid={`card-shared-property-${property.id}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              {/* Left: Property Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <h3 className="font-semibold text-base text-gray-900 truncate">
                    {property.address}
                  </h3>
                </div>
                
                {/* Property Details */}
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  {property.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {property.city}
                    </span>
                  )}
                  {property.size && (
                    <span className="flex items-center gap-1">
                      <Maximize2 className="h-3.5 w-3.5" />
                      {property.size} m²
                    </span>
                  )}
                  {property.price && (
                    <span className="flex items-center gap-1 font-medium text-gray-900">
                      <Euro className="h-3.5 w-3.5" />
                      {formatPrice(property.price)}
                    </span>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {getClassificationBadge()}
                  <Badge variant="outline" data-testid={`badge-agency-count-${property.id}`}>
                    {agencyCount} {agencyCount === 1 ? 'Agenzia' : 'Agenzie'}
                  </Badge>
                </div>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleFavorite}
                  data-testid={`button-favorite-${property.id}`}
                  className="h-8 w-8 p-0"
                >
                  <Star 
                    className={`h-4 w-4 ${property.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} 
                  />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid={`button-delete-${property.id}`}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid={`button-toggle-${property.id}`}
                    className="h-8 w-8 p-0"
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm text-gray-700 mb-2">
                  Agenzie ({agencyCount})
                </h4>
                
                {agencies.length === 0 ? (
                  <p className="text-sm text-gray-500">Nessuna agenzia trovata</p>
                ) : (
                  <div className="space-y-2">
                    {agencies.map((agency, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        data-testid={`agency-item-${index}`}
                      >
                        <span className="font-medium text-sm text-gray-900">
                          {agency.name || 'Agenzia Sconosciuta'}
                        </span>
                        {agency.link && (
                          <a 
                            href={agency.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            data-testid={`link-agency-${index}`}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Vedi Annuncio
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>

          {/* Footer with View Details button */}
          <CardFooter className="border-t pt-3">
            <Link href={`/properties/shared/${property.id}`} className="w-full">
              <Button 
                variant="outline" 
                className="w-full"
                data-testid={`button-view-details-${property.id}`}
              >
                <Eye className="h-4 w-4 mr-2" />
                Vedi Dettagli Completi
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa proprietà condivisa? 
              <br />
              <strong className="text-gray-900">{property.address}</strong>
              <br />
              <br />
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              data-testid="button-confirm-delete"
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
