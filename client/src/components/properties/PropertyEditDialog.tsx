import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { insertPropertySchema } from "@shared/schema";
import MapLocationSelector from "@/components/maps/MapLocationSelector";

// Importa il tipo direttamente dallo schema condiviso
import { type Property } from "@shared/schema";

interface PropertyEditDialogProps {
  open: boolean;
  onClose: () => void;
  property: Property;
  onSuccess?: () => void;
}

export default function PropertyEditDialog({ 
  open, 
  onClose, 
  property,
  onSuccess
}: PropertyEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Debug the property data to check what's coming in
  useEffect(() => {
    console.log("PropertyEditDialog received property:", property);
  }, [property]);
  
  // Define form with explicit typing
  const form = useForm<z.infer<typeof insertPropertySchema>>({
    resolver: zodResolver(insertPropertySchema),
    // Inizializziamo con i valori dalla proprietà direttamente
    defaultValues: {
      type: property?.type || "",
      address: property?.address || "",
      city: property?.city || "",
      size: property?.size || 0,
      price: property?.price || 0,
      bedrooms: property?.bedrooms || null,
      bathrooms: property?.bathrooms || null,
      yearBuilt: property?.yearBuilt || null,
      energyClass: property?.energyClass || null,
      description: property?.description || "",
      status: property?.status || "available",
      externalLink: property?.externalLink || "",
      location: property?.location || null,
      isShared: property?.isShared || false,
      isOwned: property?.isOwned || true,
    },
  });
  
  // Reset form when dialog opens or property changes
  useEffect(() => {
    if (open && property) {
      console.log("PropertyEditDialog - Updating form with data:", JSON.stringify(property, null, 2));
      
      // Prepariamo i valori assicurandoci che tutti i campi siano definiti
      const formValues = {
        type: property.type || "",
        address: property.address || "",
        city: property.city || "",
        size: property.size || 0,
        price: property.price || 0,
        bedrooms: property.bedrooms || null,
        bathrooms: property.bathrooms || null,
        yearBuilt: property.yearBuilt || null,
        energyClass: property.energyClass || null,
        description: property.description || "",
        status: property.status || "available",
        externalLink: property.externalLink || "",
        location: property.location || null,
        isShared: typeof property.isShared === 'boolean' ? property.isShared : false,
        isOwned: typeof property.isOwned === 'boolean' ? property.isOwned : true,
      };
      
      console.log("Form values being set:", JSON.stringify(formValues, null, 2));
      
      // Reset del form in due passaggi per assicurare l'aggiornamento corretto
      form.reset({});
      setTimeout(() => {
        form.reset(formValues);
      }, 50);
    }
  }, [form, property, open]);
  
  // Update property mutation
  const updatePropertyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertPropertySchema>) => {
      console.log("Updating property with data:", data);
      
      // Assicurati che i valori booleani siano correttamente inviati
      const updatedData = {
        ...data,
        isShared: data.isShared === undefined ? false : !!data.isShared,
        isOwned: data.isOwned === undefined ? true : !!data.isOwned,
      };
      
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore durante l'aggiornamento dell'immobile");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", property.id.toString()] });
      
      // Show success toast
      toast({
        title: "Immobile aggiornato",
        description: "Le modifiche sono state salvate con successo",
      });
      
      // Close dialog
      onClose();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      console.error("Error updating property:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'aggiornamento dell'immobile",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: z.infer<typeof insertPropertySchema>) => {
    updatePropertyMutation.mutate(data);
  };
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Immobile</DialogTitle>
          <DialogDescription>
            Modifica i dettagli dell'immobile
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Property Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipologia*</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || undefined}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipologia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="apartment">Appartamento</SelectItem>
                        <SelectItem value="house">Casa</SelectItem>
                        <SelectItem value="villa">Villa</SelectItem>
                        <SelectItem value="land">Terreno</SelectItem>
                        <SelectItem value="commercial">Commerciale</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stato*</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || undefined}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona stato" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Disponibile</SelectItem>
                        <SelectItem value="pending">In trattativa</SelectItem>
                        <SelectItem value="sold">Venduto</SelectItem>
                        <SelectItem value="reserved">Riservato</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indirizzo*</FormLabel>
                    <FormControl>
                      <Input placeholder="Via Roma, 123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* City */}
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Città*</FormLabel>
                    <FormControl>
                      <Input placeholder="Milano" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Size */}
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Superficie (m²)*</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="80" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Price */}
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prezzo (€)*</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="250000" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Bedrooms */}
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camere da letto</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Bathrooms */}
              <FormField
                control={form.control}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bagni</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="1" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Year Built */}
              <FormField
                control={form.control}
                name="yearBuilt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anno di costruzione</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2000" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Energy Class */}
              <FormField
                control={form.control}
                name="energyClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classe energetica</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona classe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A4">A4</SelectItem>
                        <SelectItem value="A3">A3</SelectItem>
                        <SelectItem value="A2">A2</SelectItem>
                        <SelectItem value="A1">A1</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                        <SelectItem value="D">D</SelectItem>
                        <SelectItem value="E">E</SelectItem>
                        <SelectItem value="F">F</SelectItem>
                        <SelectItem value="G">G</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* External Link */}
              <FormField
                control={form.control}
                name="externalLink"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Link esterno</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.immobiliare.it/annuncio/123456" 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrizione dettagliata dell'immobile" 
                      className="h-32 resize-y" 
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Map */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Posizione sulla mappa</FormLabel>
                  <FormControl>
                    <div className="h-72 w-full border rounded-md overflow-hidden">
                      <MapLocationSelector 
                        value={field.value}
                        onChange={field.onChange}
                        className="h-full w-full"
                        addressToSearch={`${form.getValues().address}, ${form.getValues().city}, Italia`}
                      />
                    </div>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Forza una ricerca dell'indirizzo sulla mappa
                          console.log("Cercando indirizzo:", `${form.getValues().address}, ${form.getValues().city}, Italia`);
                          if (form.getValues().address && form.getValues().city) {
                            // Rimuoviamo temporaneamente la posizione e la reimpostiamo subito dopo
                            // per forzare un aggiornamento del componente mappa
                            const currentLocation = field.value;
                            field.onChange(null);
                            setTimeout(() => field.onChange(currentLocation), 10);
                          }
                        }}
                      >
                        <i className="fas fa-search mr-2"></i>
                        Cerca indirizzo sulla mappa
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Seleziona la posizione esatta dell'immobile sulla mappa. Puoi cercare un indirizzo o cliccare direttamente sulla mappa.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button 
                type="submit"
                disabled={updatePropertyMutation.isPending}
              >
                {updatePropertyMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">
                      <i className="fas fa-spinner"></i>
                    </span>
                    Salvataggio in corso...
                  </>
                ) : (
                  <>Salva modifiche</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}