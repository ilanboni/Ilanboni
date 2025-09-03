import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { PropertyWithDetails } from "@/types/index";
import { PROPERTY_TYPES, CITY_AREAS } from "@/lib/constants";
import { MapSelector } from "../maps/MapSelector";

// Schema for property form
const propertyFormSchema = z.object({
  address: z.string().min(1, "L'indirizzo è necessario"),
  city: z.string().min(1, "La città è necessaria"),
  size: z.number().min(1, "La metratura deve essere maggiore di 0"),
  price: z.number().min(1, "Il prezzo deve essere maggiore di 0"),
  type: z.string().min(1, "Il tipo di immobile è necessario"),
  bedrooms: z.number().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  description: z.string().optional(),
  status: z.enum(["available", "pending", "sold"]).default("available"),
  isShared: z.boolean().default(false),
  isOwned: z.boolean().default(true),
  externalLink: z.string().url().optional().or(z.literal("")),
  location: z.any().optional(),
  // Owner information fields
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  // Shared property fields
  agencyName: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  isAcquired: z.boolean().default(false)
});

type PropertyFormValues = z.infer<typeof propertyFormSchema>;

interface PropertyFormProps {
  initialData?: PropertyWithDetails;
  onSubmit: (data: PropertyFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function PropertyForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false
}: PropertyFormProps) {
  const [isSharedProperty, setIsSharedProperty] = useState(
    initialData?.isShared || false
  );
  
  // Initialize form with default values or data from existing property
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: initialData ? {
      address: initialData.address || "",
      city: initialData.city || "",
      size: initialData.size || 0,
      price: initialData.price || 0,
      type: initialData.type || "",
      bedrooms: initialData.bedrooms || 0,
      bathrooms: initialData.bathrooms || 0,
      description: initialData.description || "",
      status: initialData.status as "available" | "pending" | "sold" || "available",
      isShared: initialData.isShared || false,
      isOwned: initialData.isOwned || true,
      externalLink: initialData.externalLink || "",
      location: initialData.location || undefined,
      // Owner information
      ownerName: initialData.ownerName || "",
      ownerPhone: initialData.ownerPhone || "",
      ownerEmail: initialData.ownerEmail || "",
      // Shared property details
      agencyName: initialData.sharedDetails?.agencyName || "",
      contactPerson: initialData.sharedDetails?.contactPerson || "",
      contactPhone: initialData.sharedDetails?.contactPhone || "",
      contactEmail: initialData.sharedDetails?.contactEmail || "",
      isAcquired: initialData.sharedDetails?.isAcquired || false
    } : {
      address: "",
      city: "Milano",
      size: 0,
      price: 0,
      type: "",
      bedrooms: 0,
      bathrooms: 0,
      description: "",
      status: "available",
      isShared: false,
      isOwned: true,
      externalLink: "",
      location: undefined,
      // Owner information
      ownerName: "",
      ownerPhone: "",
      ownerEmail: "",
      agencyName: "",
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
      isAcquired: false
    }
  });
  
  // Handle form submission
  const handleFormSubmit = (data: PropertyFormValues) => {
    onSubmit(data);
  };
  
  // Handle isShared checkbox change
  const onSharedChange = (checked: boolean) => {
    setIsSharedProperty(checked);
    form.setValue("isShared", checked);
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          {/* Property Details Tab */}
          <Tabs defaultValue="details" className="mb-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Dettagli Immobile</TabsTrigger>
              <TabsTrigger value="owner">Proprietario</TabsTrigger>
              <TabsTrigger value="description">Descrizione</TabsTrigger>
              <TabsTrigger value="sharing" disabled={!isSharedProperty}>
                Condivisione
              </TabsTrigger>
            </TabsList>
            
            {/* Basic Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indirizzo</FormLabel>
                      <FormControl>
                        <Input placeholder="Via Roma, 123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Città</FormLabel>
                      <FormControl>
                        <Input placeholder="Milano" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipologia</FormLabel>
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
                          {PROPERTY_TYPES.map((type) => (
                            <SelectItem key={type} value={type.toLowerCase()}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stato</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona stato" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Disponibile</SelectItem>
                          <SelectItem value="pending">In Trattativa</SelectItem>
                          <SelectItem value="sold">Venduto/Affittato</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metratura (m²)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="80"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="250000"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Camere da letto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="2"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="bathrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bagni</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="externalLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link al sito web</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://www.sito-immobiliare.it/annuncio-123"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            onSharedChange(checked === true);
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Immobile pluricondiviso</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Questo immobile è condiviso con altre agenzie
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isOwned"
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
                        <p className="text-sm text-muted-foreground">
                          La nostra agenzia ha acquisito questo immobile
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Posizione sulla mappa</FormLabel>
                    <FormControl>
                      <div className="h-[350px] mt-2 rounded-md border">
                        <MapSelector 
                          initialLocation={field.value}
                          onLocationSelected={field.onChange}
                          address={form.getValues("address") + ", " + form.getValues("city")}
                          autoGeocode={true}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      La posizione viene geocodificata automaticamente in base all'indirizzo inserito
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
            
            {/* Owner Information Tab */}
            <TabsContent value="owner" className="space-y-4 mt-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                <h3 className="text-sm font-medium text-green-800 mb-1">
                  Informazioni Proprietario
                </h3>
                <p className="text-sm text-green-600">
                  Inserisci i dati del proprietario dell'immobile. Se i dati vengono compilati, verrà automaticamente creato un cliente venditore.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ownerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome e Cognome</FormLabel>
                      <FormControl>
                        <Input placeholder="Mario Rossi" {...field} />
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
                        <Input 
                          type="email" 
                          placeholder="mario.rossi@email.com" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>
            
            {/* Description Tab */}
            <TabsContent value="description" className="space-y-4 mt-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione dell'immobile</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Inserisci una descrizione dettagliata dell'immobile..."
                        className="resize-none h-64"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
            
            {/* Shared Property Tab */}
            <TabsContent value="sharing" className="space-y-4 mt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <h3 className="text-sm font-medium text-blue-800 mb-1">
                  Immobile Pluricondiviso
                </h3>
                <p className="text-sm text-blue-600">
                  Inserisci le informazioni relative all'agenzia partner con cui è condiviso l'immobile.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agencyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Agenzia Partner</FormLabel>
                      <FormControl>
                        <Input placeholder="Immobiliare XYZ" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Persona di Riferimento</FormLabel>
                      <FormControl>
                        <Input placeholder="Mario Rossi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefono Contatto</FormLabel>
                      <FormControl>
                        <Input placeholder="+39 123 456 7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Contatto</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="contatto@agenzia.it" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="isAcquired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 mt-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Flag "Acquisito"</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Attiva questa opzione quando hai acquisito l'immobile per inviare link ai clienti
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </TabsContent>
          </Tabs>
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-4 mt-8">
            <Button 
              variant="outline" 
              type="button" 
              onClick={onCancel}
            >
              Annulla
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvataggio in corso..." : "Salva Immobile"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}


