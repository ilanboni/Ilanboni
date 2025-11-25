import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PropertyWithDetails } from "@shared/schema";
import { formatCurrency, getStatusColor } from "@/lib/utils";
import { 
  Edit, 
  Eye, 
  Home, 
  MapPin, 
  MoreVertical, 
  Share, 
  Trash, 
  Users,
  ExternalLink,
  Building,
  BedDouble,
  Bath
} from "lucide-react";

interface PropertyCardProps {
  property: PropertyWithDetails;
  onView: (property: PropertyWithDetails) => void;
  onEdit: (property: PropertyWithDetails) => void;
  onDelete: (property: PropertyWithDetails) => void;
  onSendToClients: (property: PropertyWithDetails) => void;
  compact?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (property: PropertyWithDetails, selected: boolean) => void;
}

export default function PropertyCard({
  property,
  onView,
  onEdit,
  onDelete,
  onSendToClients,
  compact = false,
  selectionMode = false,
  isSelected = false,
  onSelect
}: PropertyCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  // Get status text for display
  const getStatusText = (status: string): string => {
    switch (status) {
      case "available": return "Disponibile";
      case "pending": return "In Trattativa";
      case "sold": return "Venduto/Affittato";
      default: return "Sconosciuto";
    }
  };
  
  // Handle delete with confirmation
  const handleDelete = () => {
    if (showConfirmDelete) {
      onDelete(property);
      setShowConfirmDelete(false);
    } else {
      setShowConfirmDelete(true);
    }
  };
  
  // Compact card view
  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base">
              {property.address}
            </CardTitle>
            <Badge className={getStatusColor(property.status)}>
              {getStatusText(property.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="flex items-center text-sm text-gray-500 mb-1">
            <MapPin size={14} className="mr-1" /> {property.city}
          </div>
          <div className="text-sm font-medium">
            {formatCurrency(property.price)} - {property.size}m²
          </div>
        </CardContent>
        <CardFooter className="pt-0 flex justify-end">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onView(property)}
          >
            Dettagli
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Full card view
  return (
    <Card className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          {selectionMode && (
            <div className="mr-3 pt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect?.(property, !!checked)}
                data-testid={`checkbox-property-${property.id}`}
              />
            </div>
          )}
          <div className="flex-1">
            <CardTitle>{property.address}</CardTitle>
            <CardDescription className="mt-1">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                {property.city}
              </div>
            </CardDescription>
          </div>
          
          <div className="flex items-center">
            <Badge className={getStatusColor(property.status)}>
              {getStatusText(property.status)}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-2">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onView(property)}>
                  <Eye className="mr-2 h-4 w-4" /> Visualizza
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(property)}>
                  <Edit className="mr-2 h-4 w-4" /> Modifica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSendToClients(property)}>
                  <Share className="mr-2 h-4 w-4" /> Invia a Clienti
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={handleDelete}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  {showConfirmDelete ? "Conferma Eliminazione" : "Elimina"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Prezzo</div>
            <div className="text-lg font-bold" data-testid={`property-price-${property.id}`}>{formatCurrency(property.price)}</div>
          </div>
          
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Metratura</div>
            <div className="text-lg font-bold">{property.size} m²</div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 text-gray-600 text-sm mb-4">
          <div className="flex items-center mr-3">
            <Building className="h-4 w-4 mr-1" />
            <span>{property.type}</span>
          </div>
          
          {property.bedrooms !== undefined && (
            <div className="flex items-center mr-3">
              <BedDouble className="h-4 w-4 mr-1" />
              <span>{property.bedrooms} camere</span>
            </div>
          )}
          
          {property.bathrooms !== undefined && (
            <div className="flex items-center">
              <Bath className="h-4 w-4 mr-1" />
              <span>{property.bathrooms} bagni</span>
            </div>
          )}
        </div>
        
        {property.description && (
          <div className="text-sm text-gray-600 mb-4 line-clamp-3">
            {property.description}
          </div>
        )}
        
        {property.isShared && (
          <div className="flex items-center mt-2 mb-2">
            <div className={`rounded-md border ${
              property.sharedDetails?.isAcquired 
                ? "border-green-200 bg-green-50" 
                : "border-amber-200 bg-amber-50"
            } p-2 w-full`}>
              <div className="flex items-center">
                <Users className={`h-4 w-4 mr-2 ${
                  property.sharedDetails?.isAcquired 
                    ? "text-green-600" 
                    : "text-amber-600"
                }`} />
                <span className="text-sm font-medium">
                  {property.sharedDetails?.isAcquired 
                    ? "Immobile pluricondiviso (Acquisito)" 
                    : "Immobile pluricondiviso (Non acquisito)"}
                </span>
              </div>
              {property.sharedDetails?.agencyName && (
                <div className="text-xs ml-6 mt-1">
                  Agenzia: {property.sharedDetails.agencyName}
                </div>
              )}
            </div>
          </div>
        )}
        
        {property.externalLink && (
          <div className="mt-2">
            <a 
              href={property.externalLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Link al sito web
            </a>
          </div>
        )}
        
        {property.interestedClients && property.interestedClients.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Clienti interessati:</div>
            <div className="flex flex-wrap gap-2">
              {property.interestedClients.map((client) => (
                <TooltipProvider key={client.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="bg-blue-50">
                        {client.firstName} {client.lastName}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{client.type === "buyer" ? "Compratore" : "Venditore"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => onView(property)}>
          <Eye className="mr-2 h-4 w-4" /> Dettagli
        </Button>
        
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(property)}>
            <Edit className="mr-2 h-4 w-4" /> Modifica
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onSendToClients(property)}
            disabled={property.isShared && !property.sharedDetails?.isAcquired}
          >
            <Share className="mr-2 h-4 w-4" /> Invia a Clienti
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
