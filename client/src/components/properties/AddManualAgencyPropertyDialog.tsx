import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Link2, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const addManualAgencyPropertySchema = z.object({
  url: z.string().url("Inserisci un URL valido").min(1, "Link obbligatorio"),
  address: z.string().min(1, "Indirizzo obbligatorio"),
  city: z.string().default("Milano"),
  type: z.string().default("apartment"),
  price: z.coerce.number().min(0, "Prezzo deve essere positivo"),
  bedrooms: z.coerce.number().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  size: z.coerce.number().min(0).optional(),
  floor: z.string().optional(),
  description: z.string().optional(),
  agencyName: z.string().optional(),
  agencyUrl: z.string().optional(),
  agencyPhone: z.string().optional(),
  agencyEmail: z.string().optional(),
  multiAgencies: z.array(z.object({
    name: z.string(),
    url: z.string().optional(),
    phone: z.string().optional()
  })).optional()
});

type AddManualAgencyPropertyFormData = z.infer<typeof addManualAgencyPropertySchema>;

export function AddManualAgencyPropertyDialog() {
  const [open, setOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [detectedAgencies, setDetectedAgencies] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddManualAgencyPropertyFormData>({
    resolver: zodResolver(addManualAgencyPropertySchema),
    defaultValues: {
      url: "",
      address: "",
      city: "Milano",
      type: "apartment",
      price: 0,
      bedrooms: undefined,
      bathrooms: undefined,
      size: undefined,
      floor: "",
      description: "",
      agencyName: "",
      agencyUrl: "",
      agencyPhone: "",
      agencyEmail: "",
      multiAgencies: []
    }
  });

  const addPropertyMutation = useMutation({
    mutationFn: async (data: AddManualAgencyPropertyFormData) => {
      return await apiRequest("/api/properties/manual-agency", {
        method: "POST",
        data
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/multi-agency"] });
      form.reset();
      setOpen(false);
      setDetectedAgencies(null);
      
      const classification = result.property?.classificationColor === "yellow" ? "Multi-Agenzia (Giallo)" : "Singola Agenzia (Rosso)";
      toast({
        title: "Immobile aggiunto",
        description: `Proprietà agenzia salvata come ${classification}`,
      });
    },
    onError: (error: any) => {
      console.error("Errore aggiunta immobile agenzia:", error);
      toast({
        title: "Errore",
        description: error?.message || "Non è stato possibile aggiungere l'immobile.",
        variant: "destructive",
      });
    },
  });

  // Parse URL and detect multi-agency
  const handleParseUrl = async () => {
    const url = form.getValues("url");
    if (!url) {
      toast({ description: "Inserisci un URL valido", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    setDetectedAgencies(null);
    try {
      const response = await fetch("/api/properties/parse-agency-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Auto-fill form with parsed data
        if (data.address) form.setValue("address", data.address);
        if (data.price) form.setValue("price", data.price);
        if (data.bedrooms) form.setValue("bedrooms", data.bedrooms);
        if (data.bathrooms) form.setValue("bathrooms", data.bathrooms);
        if (data.size) form.setValue("size", data.size);
        if (data.description) form.setValue("description", data.description);
        if (data.agencyName) form.setValue("agencyName", data.agencyName);
        if (data.agencyPhone) form.setValue("agencyPhone", data.agencyPhone);
        if (data.agencyUrl) form.setValue("agencyUrl", data.agencyUrl || url);
        
        // Set multi-agencies if detected
        if (data.multiAgencies && data.multiAgencies.length > 0) {
          setDetectedAgencies(data);
          form.setValue("multiAgencies", data.multiAgencies);
          
          toast({
            title: "Multi-agenzia rilevato! 🟡",
            description: `${data.multiAgencies.length} agenzie trovate per questo immobile`
          });
        } else {
          toast({
            title: "Dati estratti",
            description: "I dati sono stati estratti dal link. Completa i dettagli mancanti."
          });
        }
      }
    } catch (error) {
      console.error("Errore parsing URL agenzia:", error);
      // Non mostra errore - è opzionale
    } finally {
      setIsParsing(false);
    }
  };

  const onSubmit = (data: AddManualAgencyPropertyFormData) => {
    addPropertyMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="gap-2"
          data-testid="button-add-manual-agency-property"
        >
          <Plus className="h-4 w-4" />
          <span>Aggiungi Agenzia</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aggiungi Proprietà Agenzia</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Inserisci un link e i dati verranno estratti automaticamente. Il sistema rileverà se ci sono altre agenzie che vendono lo stesso immobile.
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Alert Multi-Agency */}
            {detectedAgencies && detectedAgencies.multiAgencies && detectedAgencies.multiAgencies.length > 1 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Multi-agenzia rilevato!</strong> Questo immobile sarà salvato come GIALLO ({detectedAgencies.multiAgencies.length} agenzie)
                </AlertDescription>
              </Alert>
            )}

            {/* URL Input con Parse Button */}
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link Immobile *</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Link2 className="h-4 w-4 mt-3 text-muted-foreground flex-shrink-0" />
                      <Input 
                        placeholder="https://www.immobiliare.it/..."
                        data-testid="input-agency-property-url"
                        {...field} 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleParseUrl}
                        disabled={isParsing || !form.getValues("url")}
                        data-testid="button-parse-agency-url"
                      >
                        {isParsing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Estrai"
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Copia il link dell'annuncio e clicca "Estrai" per riempire automaticamente i dati e rilevare altre agenzie
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Indirizzo */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Indirizzo *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Via Roma 15"
                      data-testid="input-agency-property-address"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Griglia: Città, Prezzo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Città</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Milano"
                        data-testid="input-agency-property-city"
                        {...field} 
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
                    <FormLabel>Prezzo *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        placeholder="250000"
                        data-testid="input-agency-property-price"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tipo Immobile */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo Immobile</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-agency-property-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="apartment">Appartamento</SelectItem>
                      <SelectItem value="house">Casa</SelectItem>
                      <SelectItem value="villa">Villa</SelectItem>
                      <SelectItem value="penthouse">Penthouse</SelectItem>
                      <SelectItem value="loft">Loft</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Griglia: Camere, Bagni, Superficie */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camere</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        placeholder="3"
                        data-testid="input-agency-property-bedrooms"
                        {...field} 
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
                        placeholder="2"
                        data-testid="input-agency-property-bathrooms"
                        {...field} 
                      />
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
                    <FormLabel>Superficie (m²)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        placeholder="100"
                        data-testid="input-agency-property-size"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Piano */}
            <FormField
              control={form.control}
              name="floor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Piano</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="4"
                      data-testid="input-agency-property-floor"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descrizione */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrizione dell'immobile..."
                      data-testid="textarea-agency-property-description"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dati Agenzia */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Informazioni Agenzia</h3>
              
              <FormField
                control={form.control}
                name="agencyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Agenzia</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nome Agenzia Immobiliare"
                        data-testid="input-agency-name"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agencyUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link Agenzia</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.agenziaimmobiliare.it"
                        data-testid="input-agency-url"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agencyPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefono Agenzia</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="+39 02 1234 5678"
                          data-testid="input-agency-phone"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agencyEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Agenzia</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="info@agenzia.it"
                          data-testid="input-agency-email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Multi-Agencies List */}
            {detectedAgencies && detectedAgencies.multiAgencies && detectedAgencies.multiAgencies.length > 0 && (
              <div className="border-t pt-4 bg-yellow-50 p-3 rounded">
                <h3 className="font-semibold text-yellow-900 mb-2">Agenzie Rilevate</h3>
                <ul className="space-y-2 text-sm">
                  {detectedAgencies.multiAgencies.map((agency: any, idx: number) => (
                    <li key={idx} className="text-yellow-800">
                      <strong>{agency.name}</strong>
                      {agency.phone && <div className="text-xs">📞 {agency.phone}</div>}
                      {agency.url && <div className="text-xs truncate">🔗 {agency.url}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button
                type="submit"
                disabled={addPropertyMutation.isPending}
                data-testid="button-submit-agency-property"
              >
                {addPropertyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  "Salva Proprietà"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
