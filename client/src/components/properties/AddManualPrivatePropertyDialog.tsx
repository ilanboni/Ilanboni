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
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Link2, Loader2 } from "lucide-react";

const addManualPropertySchema = z.object({
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
  ownerPhone: z.string().optional(),
  ownerName: z.string().optional(),
  ownerEmail: z.string().optional(),
  hasWebContact: z.boolean().default(false) // true if property can only be contacted via website
});

type AddManualPropertyFormData = z.infer<typeof addManualPropertySchema>;

export function AddManualPrivatePropertyDialog() {
  const [open, setOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddManualPropertyFormData>({
    resolver: zodResolver(addManualPropertySchema),
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
      ownerPhone: "",
      ownerName: "",
      ownerEmail: "",
      hasWebContact: false
    }
  });

  const addPropertyMutation = useMutation({
    mutationFn: async (data: AddManualPropertyFormData) => {
      return await apiRequest("/api/properties/manual-private", {
        method: "POST",
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties/private"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-properties"] });
      form.reset();
      setOpen(false);
      
      toast({
        title: "Immobile aggiunto",
        description: "La proprietà privata è stata salvata e sarà disponibile nei matching dei tuoi buyer.",
      });
    },
    onError: (error: any) => {
      console.error("Errore aggiunta immobile:", error);
      toast({
        title: "Errore",
        description: error?.message || "Non è stato possibile aggiungere l'immobile.",
        variant: "destructive",
      });
    },
  });

  // Parse URL to extract data (optional auto-fill)
  const handleParseUrl = async () => {
    const url = form.getValues("url");
    if (!url) {
      toast({ description: "Inserisci un URL valido", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    try {
      const response = await fetch("/api/properties/parse-url", {
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
        if (data.ownerPhone) form.setValue("ownerPhone", data.ownerPhone);
        
        toast({
          title: "Dati estratti",
          description: "I dati sono stati estratti dal link. Completa i dettagli mancanti."
        });
      }
    } catch (error) {
      console.error("Errore parsing URL:", error);
      // Non mostra errore - è opzionale
    } finally {
      setIsParsing(false);
    }
  };

  const onSubmit = (data: AddManualPropertyFormData) => {
    addPropertyMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="gap-2"
          data-testid="button-add-manual-private-property"
        >
          <Plus className="h-4 w-4" />
          <span>Aggiungi Privato</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aggiungi Proprietà Privata</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Inserisci un link e i dati verranno estratti automaticamente. Potrai poi completare i dettagli.
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                        data-testid="input-manual-property-url"
                        {...field} 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleParseUrl}
                        disabled={isParsing || !form.getValues("url")}
                        data-testid="button-parse-url"
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
                    Copia il link dell'annuncio e clicca "Estrai" per riempire automaticamente i dati
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
                      data-testid="input-manual-property-address"
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
                        data-testid="input-manual-property-city"
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
                    <FormLabel>Prezzo (€) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        placeholder="250000"
                        data-testid="input-manual-property-price"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                        placeholder="2"
                        data-testid="input-manual-property-bedrooms"
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
                        placeholder="1"
                        data-testid="input-manual-property-bathrooms"
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
                        data-testid="input-manual-property-size"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tipo e Piano */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Immobile</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-manual-property-type">
                          <SelectValue placeholder="Seleziona tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="apartment">Appartamento</SelectItem>
                        <SelectItem value="house">Casa</SelectItem>
                        <SelectItem value="villa">Villa</SelectItem>
                        <SelectItem value="penthouse">Attico</SelectItem>
                        <SelectItem value="loft">Loft</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Piano</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="1"
                        data-testid="input-manual-property-floor"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Descrizione */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Dettagli aggiuntivi sull'immobile..."
                      data-testid="textarea-manual-property-description"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dati Proprietario */}
            <div className="space-y-3 p-3 bg-muted rounded-lg">
              <h4 className="font-semibold text-sm">Contatti Proprietario</h4>
              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nome</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nome proprietario"
                        data-testid="input-manual-property-owner-name"
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
                  name="ownerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Telefono</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="+39 123 456 789"
                          data-testid="input-manual-property-owner-phone"
                          {...field} 
                        />
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
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="email@example.com"
                          data-testid="input-manual-property-owner-email"
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
                name="hasWebContact"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-3 pt-3 border-t">
                    <FormControl>
                      <Checkbox 
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-web-contact-only"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-xs font-medium">Solo contatto web</FormLabel>
                      <FormDescription className="text-xs">
                        Spunta se il proprietario è raggiungibile solo tramite modulo contatto sul sito (no telefono)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel-manual-property"
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                disabled={addPropertyMutation.isPending}
                data-testid="button-save-manual-property"
              >
                {addPropertyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
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
