import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { SharedPropertyForm } from "@/components/properties/SharedPropertyForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft } from "lucide-react";
import { InsertSharedProperty } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function NewSharedPropertyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Create shared property mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertSharedProperty) => {
      return apiRequest("/api/shared-properties", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Proprietà condivisa creata",
        description: "La proprietà condivisa è stata aggiunta con successo",
      });
      
      // Redirect to the shared properties list
      setLocation("/properties/shared");
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione della proprietà condivisa",
        variant: "destructive",
      });
      console.error("Error creating shared property:", error);
    },
  });

  const handleSubmit = (data: InsertSharedProperty) => {
    createMutation.mutate(data);
  };

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/properties/shared")}
            className="mr-2"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Indietro
          </Button>
          <h1 className="text-3xl font-bold">Nuova Proprietà Condivisa</h1>
        </div>
      </div>

      <p className="text-gray-500 mb-6">
        Aggiungi una nuova proprietà che potrebbe essere condivisa con altre agenzie o che è in fase di acquisizione.
      </p>

      <SharedPropertyForm 
        onSubmit={handleSubmit} 
        isSubmitting={createMutation.isPending} 
      />
    </div>
  );
}