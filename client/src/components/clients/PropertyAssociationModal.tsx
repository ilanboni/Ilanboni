import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building, MapPin, Euro, Home, Bed, Bath } from "lucide-react";

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

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  type: string;
}

interface PropertyAssociationModalProps {
  client: Client;
  trigger?: React.ReactNode;
}

export default function PropertyAssociationModal({
  client,
  trigger
}: PropertyAssociationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available properties
  const { data: properties, isLoading: isLoadingProperties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    enabled: isOpen,
  });

  // Create seller-property association
  const associatePropertyMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      const response = await fetch(`/api/clients/${client.id}/associate-property`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ propertyId }),
      });

      if (!response.ok) {
        throw new Error("Failed to associate property");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Immobile associato",
        description: `L'immobile è stato associato a ${client.firstName} ${client.lastName}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${client.id}`] });
      setIsOpen(false);
      setSelectedPropertyId("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile associare l'immobile",
        variant: "destructive",
      });
    },
  });

  // Update property owner information
  const updateOwnerMutation = useMutation({
    mutationFn: async ({ propertyId, ownerData }: { propertyId: number; ownerData: any }) => {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ownerData),
      });

      if (!response.ok) {
        throw new Error("Failed to update property owner");
      }

      return response.json();
    },
  });

  const handleAssociate = async () => {
    if (!selectedPropertyId) return;

    const propertyId = parseInt(selectedPropertyId);
    
    try {
      // First associate the seller to the property
      await associatePropertyMutation.mutateAsync(propertyId);
      
      // Then update the property with owner information
      await updateOwnerMutation.mutateAsync({
        propertyId,
        ownerData: {
          ownerName: `${client.firstName} ${client.lastName}`.trim(),
          ownerPhone: "", // Will be filled from client data if available
          ownerEmail: "", // Will be filled from client data if available
        },
      });
    } catch (error) {
      console.error("Error in association process:", error);
    }
  };

  const selectedProperty = properties?.find(p => p.id === parseInt(selectedPropertyId));

  // Only show for seller clients
  if (client.type !== "seller") {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Building className="h-4 w-4 mr-2" />
            Associa immobile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Associa immobile a {client.firstName} {client.lastName}</DialogTitle>
          <DialogDescription>
            Seleziona un immobile da associare a questo cliente venditore.
            Il cliente diventerà il proprietario registrato dell'immobile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Seleziona immobile
            </label>
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un immobile disponibile" />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((property) => (
                  <SelectItem key={property.id} value={property.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      <span>
                        {property.address}, {property.city} - €{property.price.toLocaleString()}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProperty && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{selectedProperty.address}</h4>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        {selectedProperty.city}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {selectedProperty.status}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-green-600" />
                      <span className="font-medium">€{selectedProperty.price.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-blue-600" />
                      <span>{selectedProperty.size} m²</span>
                    </div>
                    {selectedProperty.bedrooms && (
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4 text-purple-600" />
                        <span>{selectedProperty.bedrooms} camere</span>
                      </div>
                    )}
                    {selectedProperty.bathrooms && (
                      <div className="flex items-center gap-2">
                        <Bath className="h-4 w-4 text-teal-600" />
                        <span>{selectedProperty.bathrooms} bagni</span>
                      </div>
                    )}
                  </div>

                  {selectedProperty.ownerName && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Attenzione:</strong> Questo immobile ha già un proprietario registrato: {selectedProperty.ownerName}
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        L'associazione sostituirà i dati del proprietario corrente.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={associatePropertyMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              onClick={handleAssociate}
              disabled={!selectedPropertyId || associatePropertyMutation.isPending}
            >
              {associatePropertyMutation.isPending ? "Associando..." : "Associa immobile"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}