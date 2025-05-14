import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { InsertSharedProperty, insertSharedPropertySchema } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MapSelector } from "@/components/maps/MapSelector";
import { useState } from "react";

// Extend the shared property schema with validations
const formSchema = insertSharedPropertySchema.extend({
  address: z.string().min(1, "L'indirizzo è obbligatorio"),
});

type SharedPropertyFormProps = {
  initialData?: Partial<InsertSharedProperty>;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function SharedPropertyForm({ initialData, onSubmit, onCancel, isSubmitting = false }: SharedPropertyFormProps) {
  const [locationData, setLocationData] = useState<{lat?: number; lng?: number} | null>(
    initialData?.location as {lat?: number; lng?: number} | null
  );

  // Initialize the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyId: null, // Impostiamo esplicitamente a null invece di 0 
      address: "",
      city: "",
      size: 0,
      price: 0,
      type: "apartment",
      ownerName: "",
      ownerPhone: "",
      ownerEmail: "",
      ownerNotes: "",
      floor: "",
      agency1Name: "",
      agency1Link: "",
      agency2Name: "",
      agency2Link: "",
      agency3Name: "",
      agency3Link: "",
      rating: 3,
      stage: "address_found",
      stageResult: "",
      isAcquired: false,
      matchBuyers: false,
      ...(initialData || {})
    }
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // Include location data from map
    const formData = {
      ...values,
      location: locationData
    };
    onSubmit(formData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Informazioni di base</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Indirizzo</FormLabel>
                  <FormControl>
                    <Input placeholder="Via Roma, 123" {...field} value={field.value || ""} />
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
              name="size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metratura (m²)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="80" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
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
                      placeholder="250000" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                    />
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
                  <Select onValueChange={field.onChange} value={field.value || "apartment"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipologia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="apartment">Appartamento</SelectItem>
                      <SelectItem value="house">Casa</SelectItem>
                      <SelectItem value="villa">Villa</SelectItem>
                      <SelectItem value="penthouse">Attico</SelectItem>
                      <SelectItem value="commercial">Commerciale</SelectItem>
                      <SelectItem value="land">Terreno</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valutazione importanza (1-5)</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona importanza" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1 - Bassa</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3 - Media</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5 - Alta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Indica quanto è importante questa proprietà per la tua agenzia
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Posizione sulla mappa</h3>
          <div className="h-96 mb-4">
            <MapSelector
              initialLocation={locationData}
              onLocationSelected={(location) => setLocationData(location)}
              address={form.getValues("address") + ", " + form.getValues("city")}
              autoGeocode={true}
            />
          </div>
          <FormDescription>
            La posizione viene geocodificata automaticamente in base all'indirizzo inserito
          </FormDescription>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Fase della proprietà</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fase attuale</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "address_found"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona fase" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="address_found">Indirizzo trovato</SelectItem>
                      <SelectItem value="owner_found">Proprietario trovato</SelectItem>
                      <SelectItem value="owner_contact_found">Contatto proprietario trovato</SelectItem>
                      <SelectItem value="owner_contacted">Proprietario contattato</SelectItem>
                      <SelectItem value="result">Risultato</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('stage') === 'result' && (
              <FormField
                control={form.control}
                name="stageResult"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risultato</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona risultato" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="acquired">Acquisito</SelectItem>
                        <SelectItem value="rejected">Rifiutato</SelectItem>
                        <SelectItem value="pending">In attesa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="isAcquired"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Proprietà acquisita</FormLabel>
                    <FormDescription>
                      Indica se la proprietà è stata acquisita dalla tua agenzia
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="matchBuyers"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Abbina ai potenziali acquirenti</FormLabel>
                    <FormDescription>
                      Se acquisita, abbina automaticamente ai potenziali acquirenti
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Informazioni proprietario</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome proprietario</FormLabel>
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
                  <FormLabel>Telefono proprietario</FormLabel>
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
                  <FormLabel>Email proprietario</FormLabel>
                  <FormControl>
                    <Input placeholder="mario.rossi@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note sul proprietario</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Note informative sul proprietario..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="floor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Piano dell'appartamento</FormLabel>
                  <FormControl>
                    <Input placeholder="es. 3° piano" {...field} />
                  </FormControl>
                  <FormDescription>
                    Inserisci il piano dell'appartamento (es. "Piano terra", "1° piano", "Attico")
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Link altre agenzie</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="agency1Name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome agenzia 1</FormLabel>
                    <FormControl>
                      <Input placeholder="es. Immobiliare Rossi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agency1Link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link agenzia 1</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/property/1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="agency2Name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome agenzia 2</FormLabel>
                    <FormControl>
                      <Input placeholder="es. Immobiliare Bianchi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agency2Link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link agenzia 2</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/property/1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="agency3Name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome agenzia 3</FormLabel>
                    <FormControl>
                      <Input placeholder="es. Immobiliare Verdi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agency3Link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link agenzia 3</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/property/1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Annulla
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="animate-spin mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                Salvataggio...
              </>
            ) : "Salva proprietà condivisa"}
          </Button>
        </div>
      </form>
    </Form>
  );
}