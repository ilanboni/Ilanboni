import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Euro, Home, Bed, Bath, Phone, Mail, User } from "lucide-react";
import { Link } from "wouter";

interface Property {
  id: number;
  address: string;
  city: string;
  type: string;
  price: number;
  size: number;
  bedrooms?: number;
  bathrooms?: number;
  status: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
}

interface AssociatedPropertyCardProps {
  property: Property;
  className?: string;
}

export default function AssociatedPropertyCard({ property, className = "" }: AssociatedPropertyCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">Immobile in vendita</CardTitle>
          <Badge variant="outline">
            {property.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Property Details */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Home className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-medium">{property.address}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {property.city}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-green-600" />
              <span className="font-medium">€{property.price.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-blue-600" />
              <span>{property.size} m²</span>
            </div>
            {property.bedrooms && (
              <div className="flex items-center gap-2">
                <Bed className="h-4 w-4 text-purple-600" />
                <span>{property.bedrooms} camere</span>
              </div>
            )}
            {property.bathrooms && (
              <div className="flex items-center gap-2">
                <Bath className="h-4 w-4 text-teal-600" />
                <span>{property.bathrooms} bagni</span>
              </div>
            )}
          </div>
        </div>

        {/* Owner Information */}
        {(property.ownerName || property.ownerPhone || property.ownerEmail) && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <User className="h-4 w-4" />
              <span>Proprietario</span>
            </div>
            
            {property.ownerName && (
              <p className="text-sm font-medium">{property.ownerName}</p>
            )}
            
            {property.ownerPhone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-3 w-3" />
                <span>{property.ownerPhone}</span>
              </div>
            )}
            
            {property.ownerEmail && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-3 w-3" />
                <span>{property.ownerEmail}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <Button asChild variant="outline" className="w-full" size="sm">
          <Link to={`/properties/${property.id}`}>
            Visualizza immobile
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}