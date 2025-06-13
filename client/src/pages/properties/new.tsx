import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertPropertySchema, insertSharedPropertySchema } from "@shared/schema";
import MapLocationSelector from "@/components/maps/MapLocationSelector";
import AddressSelectorPlaceholder from "@/components/address/AddressSelectorPlaceholder";
import { useAddressFormatter, standardizeAddress } from "@/utils/addressFormatter";

export default function NewPropertyPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isShared, setIsShared] = useState(false);
  const { formatOnBlur } = useAddressFormatter();
  
  // Extended schema for form validation
  const formSchema = insertPropertySchema.extend({
    // Add shared property fields
    isShared: z.boolean().default(false),
    agencyName: z.string().optional(),
    contactPerson: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
    isAcquired: z.boolean().default(false),
  });
  
  // Define form with explicit typing
  const form = useForm<z.infer<typeof insertPropertySchema> & {
    isShared: boolean;
    agencyName?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    isAcquired: boolean;
  }>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "apartment",
      address: "",
      city: "",
      size: 0,
      price: 0,
      bedrooms: null,
      bathrooms: null,
      yearBuilt: null,
      energyClass: null,
      description: "",
      status: "available",
      externalLink: null,
      location: null,
      isShared: false,
      isAcquired: false,
    },
  });
  
  // Create property mutation
  const createPropertyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Extract shared property data if needed
      const { isShared, agencyName, contactPerson, contactPhone, contactEmail, isAcquired, ...propertyData } = data;
      
      // Send property data to the API
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(propertyData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create property");
      }
      
      const result = await response.json();
      
      // If property is shared, create shared property record
      if (isShared && result && agencyName) {
        const sharedResponse = await fetch("/api/properties/shared", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            propertyId: result.id,
            agencyName,
            contactPerson: contactPerson || null,
            contactPhone: contactPhone || null,
            contactEmail: contactEmail || null,
            isAcquired: isAcquired || false,
          }),
        });
        
        if (!sharedResponse.ok) {
          console.warn("Failed to create shared property data");
        }
      }
      
      return result;
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      
      // Show success toast
      toast({
        title: "Immobile creato",
        description: "L'immobile è stato aggiunto con successo",
      });
      
      // Redirect to property list
      setLocation("/properties");
    },
    onError: (error: any) => {
      console.error("Error creating property:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante la creazione dell'immobile",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createPropertyMutation.mutate(data);
  };
  
  return (
    <>
      <Helmet>
        <title>Nuovo Immobile | Gestionale Immobiliare</title>
        <meta name="description" content="Aggiungi un nuovo immobile al sistema di gestione immobiliare" />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Nuovo Immobile</h1>
            <p className="text-gray-500 mt-1">
              Aggiungi un nuovo immobile al database
            </p>
          </div>
          <Button 
            variant="outline" 
            asChild
          >
            <Link href="/properties">
              <div className="px-2 py-1">
                <i className="fas fa-arrow-left mr-2"></i> Indietro
              </div>
            </Link>
          </Button>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Informazioni Immobile</CardTitle>
                <CardDescription>
                  Inserisci i dettagli dell'immobile da aggiungere
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                              defaultValue={field.value}
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
                            <FormDescription>
                              La tipologia di immobile
                            </FormDescription>
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
                            <FormDescription>
                              Lo stato attuale dell'immobile
                            </FormDescription>
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
                                value={field.value}
                                onChange={(address) => {
                                  field.onChange(address);
                                  // Applica la standardizzazione quando l'utente smette di digitare
                                  setTimeout(() => {
                                    const formatted = standardizeAddress(address);
                                    if (formatted !== address) {
                                      field.onChange(formatted);
                                    }
                                  }, 1000);
                                }}
                                placeholder="Inserisci l'indirizzo dell'immobile..."
                                onSelect={(data) => {
                                  // Standardizza l'indirizzo selezionato
                                  const formatted = standardizeAddress(data.address);
                                  field.onChange(formatted);
                                  // Aggiorna anche la posizione se disponibile
                                  if (data.location) {
                                    form.setValue("location", data.location);
                                  }
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
                            <FormDescription>
                              La città dove si trova l'immobile
                            </FormDescription>
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
                            <FormDescription>
                              La superficie dell'immobile in metri quadri
                            </FormDescription>
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
                            <FormDescription>
                              Il prezzo di vendita dell'immobile in euro
                            </FormDescription>
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
                            <FormDescription>
                              Il numero di camere da letto
                            </FormDescription>
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
                            <FormDescription>
                              Il numero di bagni
                            </FormDescription>
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
                                value={field.value === null ? "" : field.value}
                                onChange={(e) => {
                                  const value = e.target.value ? parseInt(e.target.value) : null;
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              L'anno in cui è stato costruito l'immobile
                            </FormDescription>
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
                                <SelectItem value="non_specificata">Non specificata</SelectItem>
                                <SelectItem value="A4">A4</SelectItem>
                                <SelectItem value="A3">A3</SelectItem>
                                <SelectItem value="A2">A2</SelectItem>
                                <SelectItem value="A1">A1</SelectItem>
                                <SelectItem value="A">A</SelectItem>
                                <SelectItem value="B">B</SelectItem>
                                <SelectItem value="C">C</SelectItem>
                                <SelectItem value="D">D</SelectItem>
                                <SelectItem value="E">E</SelectItem>
                                <SelectItem value="F">F</SelectItem>
                                <SelectItem value="G">G</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              La classe energetica dell'immobile
                            </FormDescription>
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
                            <FormDescription>
                              Link ad un annuncio esterno dell'immobile (opzionale)
                            </FormDescription>
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
                          <FormDescription>
                            Una descrizione completa dell'immobile e delle sue caratteristiche
                          </FormDescription>
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
                              <div className="h-72 w-full border rounded-md overflow-hidden">
                                <MapLocationSelector 
                                  value={field.value}
                                  onChange={field.onChange}
                                  className="h-full w-full"
                                  addressToSearch={`${form.watch('address')}, ${form.watch('city')}, Italia`}
                                />
                              </div>
                              <div className="mt-2">
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
                                    
                                    // Dopo aver azzerato, aggiungiamo un timestamp all'indirizzo per forzare la ricerca
                                    setTimeout(() => {
                                      // Aggiorniamo il valore di addressToSearch nel componente
                                      // Nota: questo forza un re-render del componente
                                      form.setValue("address", form.getValues().address + " ", { shouldDirty: false });
                                      setTimeout(() => {
                                        form.setValue("address", form.getValues().address.trim(), { shouldDirty: false });
                                      }, 10);
                                    }, 50);
                                  }}
                                >
                                  <i className="fas fa-search mr-2"></i>
                                  Cerca indirizzo sulla mappa
                                </Button>
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
                    
                    {/* Shared Property */}
                    <FormField
                      control={form.control}
                      name="isShared"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                setIsShared(checked === true);
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Immobile in condivisione</FormLabel>
                            <FormDescription>
                              Seleziona se l'immobile è condiviso con un'altra agenzia
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    {isShared && (
                      <div className="space-y-4 p-4 border rounded-md">
                        <h3 className="font-medium">Dettagli condivisione</h3>
                        
                        {/* Agency Name */}
                        <FormField
                          control={form.control}
                          name="agencyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome agenzia*</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome dell'agenzia" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Contact Person */}
                          <FormField
                            control={form.control}
                            name="contactPerson"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Persona di contatto</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome del contatto" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* Contact Phone */}
                          <FormField
                            control={form.control}
                            name="contactPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefono contatto</FormLabel>
                                <FormControl>
                                  <Input placeholder="Numero di telefono" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* Contact Email */}
                          <FormField
                            control={form.control}
                            name="contactEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email contatto</FormLabel>
                                <FormControl>
                                  <Input placeholder="Email del contatto" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* Is Acquired */}
                          <FormField
                            control={form.control}
                            name="isAcquired"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Immobile acquisito</FormLabel>
                                  <FormDescription>
                                    È un immobile acquisito dalla nostra agenzia
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setLocation("/properties")}
                      >
                        Annulla
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createPropertyMutation.isPending}
                      >
                        {createPropertyMutation.isPending ? (
                          <>
                            <span className="animate-spin mr-2">
                              <i className="fas fa-spinner"></i>
                            </span>
                            Creazione in corso...
                          </>
                        ) : (
                          <>Crea Immobile</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Informazioni</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Questa pagina ti permette di aggiungere un nuovo immobile nel database del sistema. 
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  I campi contrassegnati con * sono obbligatori.
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Se l'immobile è in condivisione con un'altra agenzia, seleziona l'opzione appropriata e compila i dettagli relativi.
                </p>
                <p className="text-sm text-gray-600">
                  Dopo aver aggiunto l'immobile, potrai associarlo a clienti, appuntamenti e altre informazioni dalla scheda di dettaglio dell'immobile.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}