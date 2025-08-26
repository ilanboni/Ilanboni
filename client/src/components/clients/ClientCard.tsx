import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ClientWithDetails, type ClientType } from "@shared/schema";
import { WhatsAppModal } from "@/components/communications/WhatsAppModal";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  MoreVertical, 
  Edit, 
  Trash, 
  Eye, 
  MessageSquare, 
  Star 
} from "lucide-react";
import { 
  formatCurrency, 
  formatDate, 
  generateGreeting
} from "@/lib/utils";

interface ClientCardProps {
  client: ClientWithDetails;
  onView: (client: ClientWithDetails) => void;
  onEdit: (client: ClientWithDetails) => void;
  onDelete: (client: ClientWithDetails) => void;
  onSendWhatsApp: (client: ClientWithDetails) => void;
  compact?: boolean;
}

export default function ClientCard({
  client,
  onView,
  onEdit,
  onDelete,
  onSendWhatsApp,
  compact = false,
}: ClientCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  
  // Format salutation for display
  const formatSalutation = (salutation: string): string => {
    switch (salutation) {
      case "dott": return "Dott.";
      case "dott.ssa": return "Dott.ssa";
      case "sig": return "Sig.";
      case "sig.ra": return "Sig.ra";
      case "ing": return "Ing.";
      case "avv": return "Avv.";
      case "prof": return "Prof.";
      case "prof.ssa": return "Prof.ssa";
      case "Gentile": return "Gentile";
      default: return "";
    }
  };
  
  // Generate client greeting
  const greeting = generateGreeting(client);
  
  // Get type badge color
  const getTypeBadgeColor = (type: ClientType) => {
    return type === "buyer" 
      ? "bg-blue-100 text-blue-800" 
      : "bg-emerald-100 text-emerald-800";
  };
  
  // Format client type for display
  const formatType = (type: ClientType) => {
    return type === "buyer" ? "Compratore" : "Venditore";
  };
  
  // Render rating stars
  const renderRating = (rating: number = 0) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            size={16} 
            className={i < rating 
              ? "text-amber-500 fill-amber-500" 
              : "text-gray-300"
            } 
          />
        ))}
      </div>
    );
  };
  
  // Handle delete with confirmation
  const handleDelete = () => {
    if (showConfirmDelete) {
      onDelete(client);
      setShowConfirmDelete(false);
    } else {
      setShowConfirmDelete(true);
    }
  };
  
  // Simple card for compact view
  if (compact) {
    return (
      <>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base">
                {formatSalutation(client.salutation)} {client.firstName} {client.lastName}
              </CardTitle>
              <Badge className={getTypeBadgeColor(client.type as ClientType)}>
                {formatType(client.type as ClientType)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <Phone size={14} className="mr-1" /> {client.phone}
            </div>
            {client.buyer && (
              <div className="text-sm text-gray-500">
                Budget: {formatCurrency(client.buyer.maxPrice || 0)}{" "}
                <span className="text-xs">({client.buyer.minSize || 0}m²+)</span>
              </div>
            )}
            {client.seller && client.properties && client.properties[0] && (
              <div className="text-sm text-gray-500">
                Immobile: {client.properties[0].address}{" "}
                <span className="text-xs">({client.properties[0].size}m²)</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0 flex justify-end">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onView(client)}
            >
              Visualizza completo
            </Button>
          </CardFooter>
        </Card>
      
        {/* WhatsApp Modal for compact view */}
        <WhatsAppModal 
          isOpen={isWhatsAppModalOpen} 
          onClose={() => setIsWhatsAppModalOpen(false)} 
          client={client}
        />
      </>
    );
  }
  
  // Detailed card
  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center">
                {formatSalutation(client.salutation)} {client.firstName} {client.lastName}
                {client.isFriend && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="ml-2 border-blue-300 text-blue-500">
                          Amico
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cliente amico - Tono informale</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                <div className="italic">{greeting}</div>
              </CardDescription>
            </div>
            
            <div className="flex items-center">
              <Badge className={getTypeBadgeColor(client.type as ClientType)}>
                {formatType(client.type as ClientType)}
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
                  <DropdownMenuItem onClick={() => onView(client)}>
                    <Eye className="mr-2 h-4 w-4" /> Visualizza
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(client)}>
                    <Edit className="mr-2 h-4 w-4" /> Modifica
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsWhatsAppModalOpen(true)}>
                    <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4">
            <div className="flex items-center text-sm text-gray-600">
              <Phone className="mr-2 h-4 w-4 text-gray-400" />
              {client.phone}
            </div>
            
            {client.email && (
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="mr-2 h-4 w-4 text-gray-400" />
                {client.email}
              </div>
            )}
            
            {client.birthday && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                Compleanno: {formatDate(client.birthday)}
              </div>
            )}
            
            {client.religion && client.religion !== "none" && (
              <div className="flex items-center text-sm text-gray-600">
                <User className="mr-2 h-4 w-4 text-gray-400" />
                Religione: {client.religion.charAt(0).toUpperCase() + client.religion.slice(1)}
              </div>
            )}
            
            {client.buyer && (
              <>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                  {client.buyer.searchArea ? "Area definita" : "Nessuna area specificata"}
                </div>
                
                <div className="md:col-span-2 mt-2">
                  <div className="flex flex-wrap gap-2">
                    {client.buyer.maxPrice && (
                      <Badge variant="outline" className="bg-gray-50">
                        Budget: {formatCurrency(client.buyer.maxPrice)}
                      </Badge>
                    )}
                    
                    {client.buyer.minSize && (
                      <Badge variant="outline" className="bg-gray-50">
                        Min: {client.buyer.minSize}m²
                      </Badge>
                    )}
                    
                    {client.buyer.urgency && (
                      <Badge variant="outline" className={
                        client.buyer.urgency >= 4 
                          ? "bg-red-50 text-red-700 border-red-200" 
                          : client.buyer.urgency >= 3 
                            ? "bg-amber-50 text-amber-700 border-amber-200" 
                            : "bg-blue-50 text-blue-700 border-blue-200"
                      }>
                        Urgenza: {client.buyer.urgency}/5
                      </Badge>
                    )}
                  </div>
                  
                  {client.buyer.rating && (
                    <div className="mt-2">
                      {renderRating(client.buyer.rating)}
                    </div>
                  )}
                  
                  {client.buyer.searchNotes && (
                    <div className="mt-2 text-sm text-gray-600 border-l-2 border-gray-200 pl-2">
                      {client.buyer.searchNotes}
                    </div>
                  )}
                </div>
              </>
            )}
            
            {client.seller && client.properties && client.properties.length > 0 && (
              <div className="md:col-span-2 mt-2 p-3 bg-gray-50 rounded-md">
                <div className="font-medium text-sm">Immobile in vendita:</div>
                <div className="text-sm text-gray-600 mt-1">
                  {client.properties[0].address}, {client.properties[0].size}m²
                </div>
                <div className="text-sm font-medium mt-1">
                  {formatCurrency(client.properties[0].price)}
                </div>
                {client.seller && 'rating' in client.seller && client.seller.rating && (
                  <div className="mt-2">
                    {renderRating(client.seller.rating)}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button variant="outline" size="sm" onClick={() => onView(client)}>
            <Eye className="mr-2 h-4 w-4" /> Scheda completa
          </Button>
          
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(client)}>
              <Edit className="mr-2 h-4 w-4" /> Modifica
            </Button>
            
            <Button 
              variant="default" 
              size="sm" 
              className="bg-green-600 hover:bg-green-700" 
              onClick={() => setIsWhatsAppModalOpen(true)}
            >
              <i className="fab fa-whatsapp mr-2"></i> WhatsApp
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      {/* WhatsApp Modal */}
      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen} 
        onClose={() => setIsWhatsAppModalOpen(false)} 
        client={client}
      />
    </>
  );
}
