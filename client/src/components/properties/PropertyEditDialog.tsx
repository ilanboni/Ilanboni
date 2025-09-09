import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { geocodeAddress } from "@/lib/geocoding";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import MapLocationSelector from "@/components/maps/MapLocationSelector";
import MapPreview from "@/components/maps/MapPreview";
import AddressSelectorPlaceholder from "@/components/address/AddressSelectorPlaceholder";

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
  
  // Extended schema for complete seller client creation
  const propertyEditSchema = insertPropertySchema.extend({
    createOwnerAsClient: z.boolean().default(false),
    ownerSalutation: z.string().optional(),
    ownerFirstName: z.string().optional(),
    ownerLastName: z.string().optional(),
    ownerBirthDate: z.date().nullable().optional(),
    ownerReligion: z.string().optional(),
    ownerIsFriend: z.boolean().default(false),
    ownerNotes: z.string().optional(),
  });

  type PropertyEditFormValues = z.infer<typeof propertyEditSchema>;

  // Define form with explicit typing
  const form = useForm<PropertyEditFormValues>({
    resolver: zodResolver(propertyEditSchema),
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
      immobiliareItId: property?.immobiliareItId || "",
      location: property?.location || null,
      isShared: property?.isShared || false,
      isOwned: property?.isOwned || true,
      ownerName: property?.ownerName || "",
      ownerPhone: property?.ownerPhone || "",
      ownerEmail: property?.ownerEmail || "",
      createOwnerAsClient: false,
      ownerSalutation: "",
      ownerFirstName: "",
      ownerLastName: "",
      ownerBirthDate: null,
      ownerReligion: "",
      ownerIsFriend: false,
      ownerNotes: "",
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
        immobiliareItId: property.immobiliareItId || "",
        location: property.location || null,
        isShared: typeof property.isShared === 'boolean' ? property.isShared : false,
        isOwned: typeof property.isOwned === 'boolean' ? property.isOwned : true,
        ownerName: property.ownerName || "",
        ownerPhone: property.ownerPhone || "",
        ownerEmail: property.ownerEmail || "",
        createOwnerAsClient: false,
        ownerSalutation: "",
        ownerFirstName: property.ownerName?.split(' ')[0] || "",
        ownerLastName: property.ownerName?.split(' ').slice(1).join(' ') || "",
        ownerBirthDate: null,
        ownerReligion: "",
        ownerIsFriend: false,
        ownerNotes: "",
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
    mutationFn: async (data: PropertyEditFormValues) => {
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
  const onSubmit = (data: PropertyEditFormValues) => {
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
                      <AddressSelectorPlaceholder
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Inserisci l'indirizzo dell'immobile..."
                        onSelect={(data) => {
                          // Aggiorna anche la posizione se disponibile
                          if (data.location) {
                            form.setValue("location", data.location);
                            console.log("Aggiornata posizione dalla selezione indirizzo:", data.location);
                          }
                          
                          // Aggiorna anche l'indirizzo completo
                          if (data.address) {
                            console.log("Impostando indirizzo da selezione:", data.address);
                            field.onChange(data.address);
                          }
                          
                          // Log per debug
                          console.log("Dati completi dalla selezione:", data);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      L'indirizzo completo dell'immobile
                    </FormDescription>
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
                    <div>
                      <div className="grid gap-4">
                        {/* Vista interattiva quando abbiamo coordinate valide */}
                        {field.value && typeof field.value === 'object' && 'lat' in field.value && 'lng' in field.value ? (
                          <div className="relative">
                            <div className="h-72 w-full border rounded-md overflow-hidden">
                              <MapPreview 
                                lat={Number((field.value as any).lat)}
                                lng={Number((field.value as any).lng)}
                                height="100%"
                              />
                            </div>
                            <div className="absolute bottom-2 right-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => field.onChange(null)}
                              >
                                Modifica posizione
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-72 w-full border rounded-md overflow-hidden">
                            <MapLocationSelector 
                              value={field.value}
                              onChange={(position) => {
                                console.log("Nuova posizione selezionata:", position);
                                field.onChange(position);
                              }}
                              className="h-full w-full"
                              addressToSearch={`${form.getValues().address}, ${form.getValues().city}, Italia`}
                            />
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            {field.value && typeof field.value === 'object' && 'lat' in field.value && 'lng' in field.value ? (
                              <span>Posizione impostata: {Number((field.value as any).lat).toFixed(6)}, {Number((field.value as any).lng).toFixed(6)}</span>
                            ) : (
                              <span>Posizione non impostata</span>
                            )}
                          </div>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Forza una ricerca dell'indirizzo sulla mappa
                              const addressToSearch = `${form.getValues().address}, ${form.getValues().city}, Italia`;
                              console.log("Cercando indirizzo:", addressToSearch);
                              
                              // Resetta il valore del campo location per permettere la ricerca dell'indirizzo
                              field.onChange(null);
                              
                              // Utilizziamo il proxy backend per Nominatim
                              geocodeAddress(addressToSearch)
                                .then(results => {
                                  if (results && results.length > 0) {
                                    const location = {
                                      lat: results[0].lat,
                                      lng: results[0].lng
                                    };
                                    
                                    console.log("Risultato geocoding:", location);
                                    
                                    if (!isNaN(location.lat) && !isNaN(location.lng)) {
                                      field.onChange(location);
                                      toast({
                                        title: "Posizione aggiornata",
                                        description: `Indirizzo trovato: ${results[0].display_name}`,
                                      });
                                    } else {
                                      console.error("Coordinate non valide:", results[0]);
                                      toast({
                                        title: "Errore",
                                        description: "Coordinate non valide ricevute dal server di geocodifica",
                                        variant: "destructive",
                                      });
                                    }
                                  } else {
                                    console.warn("Nessun risultato trovato per:", addressToSearch);
                                    toast({
                                      title: "Nessun risultato",
                                      description: `Nessun indirizzo trovato per "${addressToSearch}"`,
                                      variant: "destructive",
                                    });
                                  }
                                })
                                .catch(error => {
                                  console.error("Errore di geocoding:", error);
                                  toast({
                                    title: "Errore di geocodifica",
                                    description: error.message || "Si è verificato un errore durante la geocodifica dell'indirizzo",
                                    variant: "destructive",
                                  });
                                });
                            }}
                          >
                            <Search className="mr-2 h-4 w-4" />
                            Geocodifica indirizzo
                          </Button>
                        </div>
                      </div>
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
            
            {/* Seller Client Creation Section */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <h3 className="text-sm font-medium text-blue-800 mb-1">
                  Crea Cliente Venditore
                </h3>
                <p className="text-sm text-blue-600">
                  Inserisci i dati completi del proprietario per creare automaticamente un cliente venditore associato a questo immobile.
                </p>
              </div>
              
              <FormField
                control={form.control}
                name="createOwnerAsClient"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 mb-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Crea cliente venditore</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Attiva per creare automaticamente un cliente venditore con i dati inseriti
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              
              {form.watch("createOwnerAsClient") && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h4 className="font-medium text-gray-900">Dati Cliente Venditore</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ownerSalutation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saluto</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona saluto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Gentile Cliente">Gentile Cliente</SelectItem>
                              <SelectItem value="Egregio Signor">Egregio Signor</SelectItem>
                              <SelectItem value="Gentile Signora">Gentile Signora</SelectItem>
                              <SelectItem value="Gentile Dottore">Gentile Dottore</SelectItem>
                              <SelectItem value="Gentile Dottoressa">Gentile Dottoressa</SelectItem>
                              <SelectItem value="Gentile Ingegnere">Gentile Ingegnere</SelectItem>
                              <SelectItem value="Gentile Architetto">Gentile Architetto</SelectItem>
                              <SelectItem value="Gentile Avvocato">Gentile Avvocato</SelectItem>
                              <SelectItem value="Gentile Professor">Gentile Professor</SelectItem>
                              <SelectItem value="Gentile Professoressa">Gentile Professoressa</SelectItem>
                              <SelectItem value="Spettabile Ditta">Spettabile Ditta</SelectItem>
                              <SelectItem value="Egregi Signori">Egregi Signori</SelectItem>
                              <SelectItem value="Cara">Cara</SelectItem>
                              <SelectItem value="Caro">Caro</SelectItem>
                              <SelectItem value="Ciao">Ciao</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="ownerIsFriend"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Cliente amico</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ownerFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Mario" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="ownerLastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cognome</FormLabel>
                          <FormControl>
                            <Input placeholder="Rossi" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ownerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefono</FormLabel>
                          <FormControl>
                            <Input placeholder="+39 123 456 7890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="ownerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="mario.rossi@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ownerReligion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Religione (per auguri personalizzati)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona religione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nessuna/Non specificata</SelectItem>
                              <SelectItem value="cattolica">Cattolica</SelectItem>
                              <SelectItem value="ortodossa">Ortodossa</SelectItem>
                              <SelectItem value="protestante">Protestante</SelectItem>
                              <SelectItem value="islamica">Islamica</SelectItem>
                              <SelectItem value="ebraica">Ebraica</SelectItem>
                              <SelectItem value="induista">Induista</SelectItem>
                              <SelectItem value="buddista">Buddista</SelectItem>
                              <SelectItem value="altra">Altra</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="ownerBirthDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data di nascita</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP", { locale: it })
                                  ) : (
                                    "Seleziona data"
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="ownerNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note sul cliente</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Inserisci qui eventuali note sul cliente..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              {!form.watch("createOwnerAsClient") && (
                <>
                  <h3 className="text-lg font-medium">Informazioni Proprietario</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Inserisci i dati di contatto del proprietario dell'immobile (opzionale)
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ownerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome proprietario</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Mario Rossi" 
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="ownerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefono proprietario</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+39 123 456 7890" 
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="ownerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email proprietario</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="mario.rossi@email.com" 
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
            
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