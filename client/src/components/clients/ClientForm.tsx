import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { RELIGIONS, SALUTATIONS } from "@/lib/constants";
import { ClientType } from "@/types";
import { ClientWithDetails } from "@shared/schema";
import { cn } from "@/lib/utils";
import { SimpleAreaSelector } from "../maps/SimpleAreaSelector";

// Schema definition for client form
const clientFormSchema = z.object({
  type: z.enum(["buyer", "seller"]),
  salutation: z.string().min(1, "La formula di saluto è necessaria"),
  firstName: z.string().min(1, "Il nome è necessario"),
  lastName: z.string().min(1, "Il cognome è necessario"),
  isFriend: z.boolean().default(false),
  email: z.string().email("Indirizzo email non valido").optional().or(z.literal("")),
  phone: z.string().min(6, "Numero di telefono non valido").regex(/^[0-9+\s-]*$/, "Inserisci un numero di telefono valido"),
  religion: z.string().optional().or(z.literal("")),
  birthday: z.date().optional().nullable(),
  contractType: z.enum(["rent", "sale"]).optional().nullable(),
  notes: z.string().optional().or(z.literal("")),
  searchLink: z.string().url("Inserisci un URL valido").optional().or(z.literal("")),
  // Buyer-specific fields
  searchArea: z.any().optional().nullable(),
  minSize: z.union([z.number().min(0), z.string().regex(/^\d*$/, "Inserisci solo numeri").transform(val => val === "" ? null : Number(val)), z.null(), z.undefined()]),
  maxPrice: z.union([z.number().min(0), z.string().regex(/^\d*$/, "Inserisci solo numeri").transform(val => val === "" ? null : Number(val)), z.null(), z.undefined()]),
  urgency: z.union([z.number().min(1).max(5), z.null(), z.undefined()]).optional(),
  rating: z.union([z.number().min(1).max(5), z.null(), z.undefined()]).optional(),
  searchNotes: z.string().optional().or(z.literal("")),
  // Seller-specific fields
  propertyAddress: z.string().optional().or(z.literal("")),
  propertySize: z.union([z.number().min(0), z.string().regex(/^\d*$/, "Inserisci solo numeri").transform(val => val === "" ? null : Number(val)), z.null(), z.undefined()]),
  propertyPrice: z.union([z.number().min(0), z.string().regex(/^\d*$/, "Inserisci solo numeri").transform(val => val === "" ? null : Number(val)), z.null(), z.undefined()]),
  propertyNotes: z.string().optional().or(z.literal(""))
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  initialData?: ClientWithDetails;
  buyerPreferences?: { searchArea?: any; minSize?: number; maxPrice?: number; urgency?: number; rating?: number; searchNotes?: string };
  onSubmit: (data: ClientFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function ClientForm({ 
  initialData, 
  buyerPreferences,
  onSubmit, 
  onCancel, 
  isSubmitting = false 
}: ClientFormProps) {
  // Set default tab based on initial data or default to "buyer"
  const [clientType, setClientType] = useState<ClientType>(
    initialData?.type as ClientType || "buyer"
  );
  
  // Debug info
  console.log("ClientForm - initialData:", initialData);
  console.log("ClientForm - buyerPreferences:", buyerPreferences);
  
  // Form initialization with type casting to fix TypeScript errors
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: (initialData ? {
      type: initialData.type as ClientType,
      salutation: initialData.salutation || "",
      firstName: initialData.firstName || "",
      lastName: initialData.lastName || "",
      isFriend: initialData.isFriend || false,
      email: initialData.email || "",
      phone: initialData.phone || "",
      religion: initialData.religion || "",
      birthday: initialData.birthday ? new Date(initialData.birthday) : undefined,
      contractType: initialData.contractType as "rent" | "sale" | undefined,
      notes: initialData.notes || "",
      searchLink: initialData.searchLink || "",
      // Buyer fields - prima utilizza le preferenze separate, poi fallback sui dati cliente
      searchArea: buyerPreferences?.searchArea || initialData.buyer?.searchArea || null,
      minSize: buyerPreferences?.minSize !== undefined ? Number(buyerPreferences.minSize) : 
             initialData.buyer?.minSize !== undefined ? Number(initialData.buyer.minSize) : undefined,
      maxPrice: buyerPreferences?.maxPrice !== undefined ? Number(buyerPreferences.maxPrice) : 
              initialData.buyer?.maxPrice !== undefined ? Number(initialData.buyer.maxPrice) : undefined,
      urgency: buyerPreferences?.urgency !== undefined ? Number(buyerPreferences.urgency) : 
              initialData.buyer?.urgency !== undefined ? Number(initialData.buyer.urgency) : 3,
      rating: buyerPreferences?.rating !== undefined ? Number(buyerPreferences.rating) : 
             initialData.buyer?.rating !== undefined ? Number(initialData.buyer.rating) : 3,
      searchNotes: buyerPreferences?.searchNotes || initialData.buyer?.searchNotes || "",
      // Seller fields - necessario estendere l'interfaccia per includere questi
      propertyAddress: initialData.seller?.propertyId?.toString() || "",
      propertySize: 0,
      propertyPrice: 0,
      propertyNotes: ""
    } : {
      type: "buyer",
      salutation: "",
      firstName: "",
      lastName: "",
      isFriend: false,
      email: "",
      phone: "",
      religion: "",
      birthday: undefined,
      contractType: undefined,
      notes: "",
      searchLink: "",
      // Default buyer values - utilizza le preferenze separate se disponibili
      searchArea: buyerPreferences?.searchArea || null,
      minSize: buyerPreferences?.minSize !== undefined ? Number(buyerPreferences.minSize) : undefined,
      maxPrice: buyerPreferences?.maxPrice !== undefined ? Number(buyerPreferences.maxPrice) : undefined,
      urgency: buyerPreferences?.urgency !== undefined ? Number(buyerPreferences.urgency) : 3,
      rating: buyerPreferences?.rating !== undefined ? Number(buyerPreferences.rating) : 3,
      searchNotes: buyerPreferences?.searchNotes || "",
      // Default seller values
      propertyAddress: "",
      propertySize: 0,
      propertyPrice: 0,
      propertyNotes: ""
    }) as any
  });
  
  // Log per debug
  console.log("ClientForm - form default values:", form.formState.defaultValues);
  
  // Update form when tab changes
  const handleTabChange = (type: ClientType) => {
    setClientType(type);
    form.setValue("type", type);
  };
  
  // Handle form submission
  const handleFormSubmit = (data: ClientFormValues) => {
    onSubmit(data);
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          {/* Client Type Tabs */}
          <Tabs
            defaultValue={clientType}
            onValueChange={(value) => handleTabChange(value as ClientType)}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buyer">Compratore</TabsTrigger>
              <TabsTrigger value="seller">Venditore</TabsTrigger>
            </TabsList>
            
            {/* Hidden Type Field */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <input type="hidden" {...field} />
              )}
            />
            
            {/* Basic Client Information - Common for both types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <FormField
                control={form.control}
                name="salutation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titolo</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un titolo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SALUTATIONS.map((salutation) => (
                          <SelectItem key={salutation.value} value={salutation.value}>
                            {salutation.label}
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
                name="isFriend"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Cliente amico</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Utilizzare un tono informale nelle comunicazioni
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cognome</FormLabel>
                    <FormControl>
                      <Input placeholder="Cognome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@esempio.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="religion"
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
                        {RELIGIONS.map((religion) => (
                          <SelectItem key={religion.value} value={religion.value}>
                            {religion.label}
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
                name="birthday"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data di nascita</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: it })
                            ) : (
                              <span>Seleziona data</span>
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
              
              <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Tipo Contratto</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="sale" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Acquisto
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="rent" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Affitto
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Notes field - common for both types */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Note generali</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Inserisci qui eventuali note sul cliente..."
                      className="resize-none h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Search Link field - common for both types */}
            <FormField
              control={form.control}
              name="searchLink"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Link ricerca (Casafari)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://www.casafari.com/..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Buyer Specific Fields */}
            <TabsContent value="buyer" className="mt-6 space-y-4">
              <h3 className="text-lg font-medium">Dettagli Ricerca Immobile</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metratura Minima (m²)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="80"
                          value={field.value === null || field.value === undefined ? '' : field.value}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : Number(e.target.value);
                            field.onChange(value);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="maxPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Massimo (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="300000"
                          value={field.value === null || field.value === undefined ? '' : field.value}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : Number(e.target.value);
                            field.onChange(value);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
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
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgenza Acquisto (1-5)</FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={5}
                          step={1}
                          defaultValue={[field.value || 3]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-4"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-gray-500 px-1">
                        <span>Bassa</span>
                        <span>Media</span>
                        <span>Alta</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating Cliente (1-5)</FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={5}
                          step={1}
                          defaultValue={[field.value || 3]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-4"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-gray-500 px-1">
                        <span>Basso</span>
                        <span>Medio</span>
                        <span>Alto</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="searchNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note specifiche di ricerca</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Inserisci dettagli specifici sulla ricerca..."
                        className="resize-none h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="searchArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area geografica di ricerca</FormLabel>
                    <FormControl>
                      <div className="h-[350px] mt-2 rounded-md border">
                        <div className="relative w-full h-full">
                          <SimpleAreaSelector 
                            initialArea={field.value}
                            onAreaSelected={(area) => field.onChange(area)} 
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
            
            {/* Seller Specific Fields */}
            <TabsContent value="seller" className="mt-6 space-y-4">
              <h3 className="text-lg font-medium">Dettagli Immobile da Vendere</h3>
              
              <FormField
                control={form.control}
                name="propertyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indirizzo Immobile</FormLabel>
                    <FormControl>
                      <Input placeholder="Via Roma, 42, Milano" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="propertySize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metratura (m²)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="100"
                          value={field.value === null || field.value === undefined ? '' : field.value}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : Number(e.target.value);
                            field.onChange(value);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="propertyPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo Richiesto (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="350000"
                          value={field.value === null || field.value === undefined ? '' : field.value}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : Number(e.target.value);
                            field.onChange(value);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="propertyNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note sull'immobile</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Inserisci dettagli sull'immobile da vendere..."
                        className="resize-none h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating dell'Immobile (1-5)</FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        defaultValue={[field.value || 3]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="py-4"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-gray-500 px-1">
                      <span>Basso</span>
                      <span>Medio</span>
                      <span>Alto</span>
                    </div>
                    <FormMessage />
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
              {isSubmitting ? "Salvataggio in corso..." : "Salva Cliente"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Using the imported SimpleAreaSelector component from maps folder
