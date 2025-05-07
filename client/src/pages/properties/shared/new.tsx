import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { InsertSharedProperty } from "@shared/schema";
import { SharedPropertyForm } from "@/components/properties/SharedPropertyForm";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function NewSharedPropertyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: InsertSharedProperty) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch("/api/shared-properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Si è verificato un errore durante la creazione della proprietà condivisa.");
      }
      
      const newProperty = await response.json();
      
      // Invalidate shared properties cache
      await queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      
      toast({
        title: "Proprietà condivisa creata",
        description: "La proprietà condivisa è stata creata con successo.",
      });
      
      // Redirect to the new property
      setLocation(`/properties/shared/${newProperty.id}`);
    } catch (err) {
      console.error("Error creating shared property:", err);
      setError(err instanceof Error ? err.message : "Si è verificato un errore durante la creazione della proprietà condivisa.");
      
      toast({
        variant: "destructive",
        title: "Errore",
        description: err instanceof Error ? err.message : "Si è verificato un errore durante la creazione della proprietà condivisa.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    setLocation("/properties/shared");
  };
  
  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/properties/shared")}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <h1 className="text-3xl font-bold">Nuova Proprietà Condivisa</h1>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Card className="p-6">
        <SharedPropertyForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </Card>
    </div>
  );
}