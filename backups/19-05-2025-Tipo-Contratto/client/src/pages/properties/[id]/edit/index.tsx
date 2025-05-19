import { useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Form schema for property validation
const formSchema = z.object({
  type: z.string(),
  address: z.string().min(3, "L'indirizzo deve essere di almeno 3 caratteri"),
  city: z.string().min(2, "La città deve essere di almeno 2 caratteri"),
  size: z.coerce.number().min(1, "La dimensione deve essere maggiore di 0"),
  price: z.coerce.number().min(1, "Il prezzo deve essere maggiore di 0"),
  bedrooms: z.coerce.number().optional().nullable(),
  bathrooms: z.coerce.number().optional().nullable(),
  floor: z.coerce.number().optional().nullable(),
  yearBuilt: z.coerce.number().optional().nullable(),
  energyClass: z.string().optional().nullable(),
  hasGarage: z.boolean().optional().nullable(),
  hasGarden: z.boolean().optional().nullable(),
  status: z.string(),
  notes: z.string().optional().nullable(),
  location: z.any().optional(), // This should be a proper GeoJSON object in a real app
});

const PropertyEditPage = () => {
  console.log("PropertyEditPage - COMPONENT LOADED (CORRECT PATH VERSION)");
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  console.log("PropertyEditPage - params:", params);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get ID from URL parameters
  const id = parseInt(params.id);
  console.log("PropertyEditPage - ID from params:", id);

  // Fetch property data
  const { data: property, isLoading, error: fetchError } = useQuery({
    queryKey: ["/api/properties", id],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch property");
      }
      return response.json();
    },
    enabled: !isNaN(id)
  });

  // Set up form with default values from fetched property
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "",
      address: "",
      city: "",
      size: 0,
      price: 0,
      bedrooms: null,
      bathrooms: null,
      floor: null,
      yearBuilt: null,
      energyClass: null,
      hasGarage: false,
      hasGarden: false,
      status: "available",
      notes: "",
      location: null
    },
  });

  // Update form values when property data is loaded
  useEffect(() => {
    if (property) {
      console.log("Setting form values with property:", property);
      form.reset({
        type: property.type || "",
        address: property.address || "",
        city: property.city || "",
        size: property.size || 0,
        price: property.price || 0,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        floor: property.floor,
        yearBuilt: property.yearBuilt,
        energyClass: property.energyClass || null,
        hasGarage: property.hasGarage || false,
        hasGarden: property.hasGarden || false,
        status: property.status || "available",
        notes: property.notes || "",
        location: property.location
      });
    }
  }, [property, form]);

  // Mutation for updating a property
  const updatePropertyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update property");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id] });
      
      // Show success toast
      toast({
        title: "Immobile aggiornato",
        description: "L'immobile è stato aggiornato con successo",
      });
      
      // Redirect to property details
      setLocation(`/properties/${id}`);
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
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("Submitting form with data:", data);
    updatePropertyMutation.mutate(data);
  };

  // Show loading state while fetching property
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin">
          <i className="fas fa-spinner text-3xl"></i>
        </div>
        <p className="mt-4">Caricamento immobile in corso...</p>
      </div>
    );
  }

  // Show error state if fetch fails
  if (fetchError || !property) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500">
          <i className="fas fa-exclamation-triangle text-3xl"></i>
        </div>
        <p className="mt-4">Errore nel caricamento dell'immobile</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/properties">Torna alla lista immobili</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>Modifica Immobile | Gestionale Immobiliare</title>
        <meta name="description" content="Modifica i dettagli dell'immobile nel sistema di gestione immobiliare" />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Modifica Immobile</h1>
            <p className="text-gray-500 mt-1">
              Modifica i dettagli di {property.address}, {property.city}
            </p>
          </div>
          <Button 
            variant="outline" 
            asChild
          >
            <Link href={`/properties/${id}`}>
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
                  Modifica i dettagli dell'immobile
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
                              value={field.value}
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
                                <SelectItem value="office">Ufficio</SelectItem>
                                <SelectItem value="commercial">Commerciale</SelectItem>
                                <SelectItem value="land">Terreno</SelectItem>
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
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona stato" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="available">Disponibile</SelectItem>
                                <SelectItem value="sold">Venduto</SelectItem>
                                <SelectItem value="rented">Affittato</SelectItem>
                                <SelectItem value="pending">In trattativa</SelectItem>
                                <SelectItem value="inactive">Non disponibile</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Address */}
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Indirizzo*</FormLabel>
                          <FormControl>
                            <Input placeholder="Via/Piazza e numero civico" {...field} />
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
                            <Input placeholder="Città" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Size */}
                      <FormField
                        control={form.control}
                        name="size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dimensione (mq)*</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="1" {...field} />
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
                              <Input type="number" min="0" step="1000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Bedrooms */}
                      <FormField
                        control={form.control}
                        name="bedrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Locali</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
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
                                min="0" 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Floor */}
                      <FormField
                        control={form.control}
                        name="floor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Piano</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="-1" 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                min="1900" 
                                max={new Date().getFullYear()} 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
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
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona classe energetica" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Non specificata</SelectItem>
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
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Has Garage */}
                      <FormField
                        control={form.control}
                        name="hasGarage"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 rounded-md p-3 shadow-sm">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm cursor-pointer">
                              Garage/Posto auto
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      
                      {/* Has Garden */}
                      <FormField
                        control={form.control}
                        name="hasGarden"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 rounded-md p-3 shadow-sm">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm cursor-pointer">
                              Giardino/Terrazzo
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note interne</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Note e appunti sull'immobile (visibili solo internamente)" 
                              className="min-h-[120px]" 
                              {...field} 
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end pt-4">
                      <Button 
                        type="submit" 
                        disabled={updatePropertyMutation.isPending}
                        className="gap-2"
                      >
                        {updatePropertyMutation.isPending && (
                          <div className="animate-spin">
                            <i className="fas fa-spinner"></i>
                          </div>
                        )}
                        Aggiorna Immobile
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            {/* Description Card */}
            <Card>
              <CardHeader>
                <CardTitle>Descrizione</CardTitle>
                <CardDescription>
                  Descrizione pubblica dell'immobile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Descrizione dettagliata dell'immobile" 
                  className="min-h-[200px]" 
                  value={property?.description || ""}
                  onChange={(e) => {
                    // Here we're updating the property description outside the form
                    // In a real app, you would include this in the form schema
                    const newData = { ...property, description: e.target.value };
                    // You would then submit this data along with the form
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default PropertyEditPage;