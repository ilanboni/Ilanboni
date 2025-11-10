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
import { Plus, Link2 } from "lucide-react";

interface AddPropertyToClientDialogProps {
  clientId: number;
  clientName?: string;
}

const addPropertyFormSchema = z.object({
  url: z.string().url("Inserisci un URL valido").min(1, "Link obbligatorio"),
  address: z.string().min(1, "Indirizzo obbligatorio"),
  city: z.string().default("Milano"),
  type: z.string().min(1, "Tipo obbligatorio"),
  price: z.coerce.number().min(0, "Prezzo deve essere positivo"),
  size: z.coerce.number().min(0, "Superficie deve essere positiva").optional(),
  floor: z.string().optional(),
  notes: z.string().optional()
});

type AddPropertyFormData = z.infer<typeof addPropertyFormSchema>;

export function AddPropertyToClientDialog({ clientId, clientName }: AddPropertyToClientDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddPropertyFormData>({
    resolver: zodResolver(addPropertyFormSchema),
    defaultValues: {
      url: "",
      address: "",
      city: "Milano",
      type: "apartment",
      price: 0,
      size: 0,
      floor: "",
      notes: ""
    }
  });

  const addPropertyMutation = useMutation({
    mutationFn: async (data: AddPropertyFormData) => {
      return await apiRequest("/api/shared-properties/manual", {
        method: "POST",
        data: {
          ...data,
          scrapedForClientId: clientId
        }
      });
    },
    onSuccess: (response: { isDuplicate?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-properties"] });
      // Invalidate all task queries (includes ActivityTimeline queries with filters)
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      form.reset();
      setOpen(false);
      
      if (response.isDuplicate) {
        toast({
          title: "Immobile già presente",
          description: "Questo immobile era già stato aggiunto. L'attività di ricerca è stata collegata al tuo cliente.",
        });
      } else {
        toast({
          title: "Immobile aggiunto",
          description: "L'immobile è stato aggiunto ai preferiti e verrà visualizzato tra le proprietà multi-agency. È stata creata un'attività di ricerca.",
        });
      }
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

  const onSubmit = (data: AddPropertyFormData) => {
    addPropertyMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
          data-testid="button-add-property-to-client"
        >
          <Plus className="h-4 w-4" />
          <span>Aggiungi Immobile</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Aggiungi Immobile Manualmente {clientName && `per ${clientName}`}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            L'immobile sarà aggiunto ai preferiti multi-agency e potrà essere acquisito successivamente
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link Immobile *</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Link2 className="h-4 w-4 mt-3 text-muted-foreground" />
                      <Input 
                        placeholder="https://www.immobiliare.it/..."
                        data-testid="input-property-url"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Link all'annuncio su Immobiliare.it, Idealista, o altro portale
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indirizzo *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Via Roma 15"
                        data-testid="input-property-address"
                        {...field} 
                      />
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
                      <Input 
                        placeholder="Milano"
                        data-testid="input-property-city"
                        {...field} 
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
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-property-type">
                          <SelectValue placeholder="Seleziona tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="apartment">Appartamento</SelectItem>
                        <SelectItem value="house">Casa</SelectItem>
                        <SelectItem value="villa">Villa</SelectItem>
                        <SelectItem value="loft">Loft</SelectItem>
                        <SelectItem value="office">Ufficio</SelectItem>
                        <SelectItem value="commercial">Commerciale</SelectItem>
                        <SelectItem value="other">Altro</SelectItem>
                      </SelectContent>
                    </Select>
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
                        data-testid="input-property-price"
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
                        placeholder="80"
                        data-testid="input-property-size"
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
                    <FormLabel>Piano</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="3"
                        data-testid="input-property-floor"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Dettagli aggiuntivi, caratteristiche particolari..."
                      rows={3}
                      data-testid="textarea-property-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                disabled={addPropertyMutation.isPending}
                data-testid="button-submit-property"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Aggiungi Immobile
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
