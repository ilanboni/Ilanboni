import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText,
  Plus, 
  Trash2,
  Paperclip
} from "lucide-react";
import { SharedPropertyNote } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface SharedPropertyNotesProps {
  sharedPropertyId: number;
}

export default function SharedPropertyNotes({ sharedPropertyId }: SharedPropertyNotesProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState({
    subject: "",
    notes: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Fetch notes
  const { 
    data: notes, 
    isLoading, 
    error 
  } = useQuery<SharedPropertyNote[]>({
    queryKey: ['/api/shared-properties', sharedPropertyId, 'notes'],
    queryFn: async () => {
      const response = await fetch(`/api/shared-properties/${sharedPropertyId}/notes`);
      if (!response.ok) {
        throw new Error("Errore nel caricamento delle note");
      }
      return response.json();
    }
  });

  // Create note mutation
  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/shared-properties/${sharedPropertyId}/notes`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Errore nella creazione della nota");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', sharedPropertyId, 'notes'] });
      toast({
        title: "Nota creata",
        description: "La nota è stata aggiunta con successo.",
      });
      setIsAddDialogOpen(false);
      setNewNote({ subject: "", notes: "" });
      setSelectedFile(null);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione della nota.",
        variant: "destructive",
      });
    }
  });

  // Delete note mutation
  const deleteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const response = await fetch(`/api/shared-properties/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error("Errore nell'eliminazione della nota");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', sharedPropertyId, 'notes'] });
      toast({
        title: "Nota eliminata",
        description: "La nota è stata eliminata con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione della nota.",
        variant: "destructive",
      });
    }
  });

  const handleCreateNote = () => {
    if (!newNote.subject || !newNote.notes) {
      toast({
        title: "Campi obbligatori",
        description: "Oggetto e note sono obbligatori.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('subject', newNote.subject);
    formData.append('notes', newNote.notes);
    if (selectedFile) {
      formData.append('attachment', selectedFile);
    }

    createMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Note e Considerazioni
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Note e Considerazioni
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Errore nel caricamento delle note</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Note e Considerazioni
        </CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-note">
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi Nota
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi Nuova Nota</DialogTitle>
              <DialogDescription>
                Aggiungi una nota o considerazione su questa proprietà condivisa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Oggetto *</Label>
                <Input
                  id="subject"
                  data-testid="input-note-subject"
                  placeholder="Es: Trovato proprietario ma manca contatto"
                  value={newNote.subject}
                  onChange={(e) => setNewNote({ ...newNote, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Note *</Label>
                <Textarea
                  id="notes"
                  data-testid="textarea-note-content"
                  placeholder="Inserisci qui le tue note e considerazioni..."
                  value={newNote.notes}
                  onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attachment">Allegato (opzionale)</Label>
                <Input
                  id="attachment"
                  type="file"
                  data-testid="input-note-attachment"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    File selezionato: {selectedFile.name}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                data-testid="button-cancel-note"
              >
                Annulla
              </Button>
              <Button
                onClick={handleCreateNote}
                disabled={createMutation.isPending}
                data-testid="button-save-note"
              >
                {createMutation.isPending ? "Salvataggio..." : "Salva Nota"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!notes || notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nessuna nota presente.</p>
            <p className="text-sm">Clicca su "Aggiungi Nota" per iniziare.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead className="min-w-[200px]">Oggetto</TableHead>
                  <TableHead className="min-w-[300px]">Note</TableHead>
                  <TableHead className="w-[100px]">Allegato</TableHead>
                  <TableHead className="w-[80px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((note) => (
                  <TableRow key={note.id} data-testid={`row-note-${note.id}`}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(note.createdAt), "dd MMM yyyy", { locale: it })}
                    </TableCell>
                    <TableCell className="font-medium">{note.subject}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {note.notes}
                    </TableCell>
                    <TableCell>
                      {note.attachmentName && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Paperclip className="h-4 w-4" />
                          <span className="truncate max-w-[80px]" title={note.attachmentName}>
                            {note.attachmentName}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(note.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-note-${note.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
