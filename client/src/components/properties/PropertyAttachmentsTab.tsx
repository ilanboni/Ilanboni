import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Download, Trash, File, Image, FileCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  useSharedPropertyAttachments,
  useUploadPropertyAttachment,
  useDeletePropertyAttachment
} from "@/hooks/useSharedPropertyAttachments";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const uploadSchema = z.object({
  category: z.string().min(1, "Categoria richiesta"),
  notes: z.string().optional()
});

type UploadFormData = z.infer<typeof uploadSchema>;

const categories = [
  { value: "visura", label: "Visura Catastale", icon: FileCheck },
  { value: "planimetria", label: "Planimetria", icon: FileText },
  { value: "foto", label: "Foto", icon: Image },
  { value: "contratto", label: "Contratto", icon: FileText },
  { value: "altro", label: "Altro", icon: File }
];

interface PropertyAttachmentsTabProps {
  sharedPropertyId: number;
}

export default function PropertyAttachmentsTab({ sharedPropertyId }: PropertyAttachmentsTabProps) {
  const { toast } = useToast();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: attachments, isLoading } = useSharedPropertyAttachments(sharedPropertyId);
  const uploadMutation = useUploadPropertyAttachment(sharedPropertyId);
  const deleteMutation = useDeletePropertyAttachment(sharedPropertyId);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      category: "altro",
      notes: ""
    }
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
      setIsUploadDialogOpen(true);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
      setIsUploadDialogOpen(true);
    }
  };

  const onSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        description: "Nessun file selezionato"
      });
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        category: data.category,
        notes: data.notes
      });
      toast({ description: "File caricato con successo" });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      form.reset();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Errore durante il caricamento"
      });
    }
  };

  const handleDelete = async (attachmentId: number) => {
    if (!confirm("Sei sicuro di voler eliminare questo allegato?")) return;
    
    try {
      await deleteMutation.mutateAsync(attachmentId);
      toast({ description: "Allegato eliminato con successo" });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Errore durante l'eliminazione dell'allegato"
      });
    }
  };

  const handleDownload = async (attachmentId: number, filename: string) => {
    try {
      const response = await fetch(`/api/shared-properties/${sharedPropertyId}/attachments/${attachmentId}/download`);
      if (!response.ok) throw new Error('Errore download');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Errore durante il download del file"
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.icon || File;
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || category;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Documenti e Allegati</h3>
          <p className="text-sm text-gray-500">
            Carica visure, planimetrie, foto e altri documenti relativi alla proprietà
          </p>
        </div>
        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-file-upload"
          />
          <Button asChild data-testid="button-upload-file">
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Carica File
            </label>
          </Button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        data-testid="dropzone"
      >
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-sm text-gray-600">
          Trascina i file qui oppure clicca "Carica File"
        </p>
        <p className="text-xs text-gray-400 mt-2">
          PDF, immagini, documenti (max 50MB)
        </p>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
        setIsUploadDialogOpen(open);
        if (!open) {
          setSelectedFile(null);
          form.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carica Allegato</DialogTitle>
            <DialogDescription>
              {selectedFile && `File selezionato: ${selectedFile.name}`}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-attachment-category">
                          <SelectValue placeholder="Seleziona categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map(cat => {
                          const Icon = cat.icon;
                          return (
                            <SelectItem key={cat.value} value={cat.value} data-testid={`option-category-${cat.value}`}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {cat.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (opzionale)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Aggiungi note sull'allegato..." 
                        {...field}
                        data-testid="textarea-attachment-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setSelectedFile(null);
                    form.reset();
                  }}
                  data-testid="button-cancel-upload"
                >
                  Annulla
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending} data-testid="button-confirm-upload">
                  {uploadMutation.isPending ? "Caricamento..." : "Carica"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Attachments Grid */}
      {!attachments || attachments.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nessun allegato caricato. Trascina i file nella zona sopra o clicca "Carica File".
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attachments.map((attachment) => {
            const Icon = getCategoryIcon(attachment.category);

            return (
              <Card key={attachment.id} data-testid={`attachment-${attachment.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate" data-testid={`attachment-filename-${attachment.id}`}>
                        {attachment.filename}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(attachment.category)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(attachment.filesize)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(attachment.createdAt), "d MMM yyyy", { locale: it })}
                      </p>
                      {attachment.notes && (
                        <p className="text-xs text-gray-600 mt-2" data-testid={`attachment-notes-${attachment.id}`}>
                          {attachment.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownload(attachment.id, attachment.filename)}
                      data-testid={`button-download-${attachment.id}`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(attachment.id)}
                      data-testid={`button-delete-attachment-${attachment.id}`}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
