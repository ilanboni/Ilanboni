import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface WhatsAppImportDialogProps {
  clientId: number;
  onSuccess?: () => void;
}

export function WhatsAppImportDialog({ clientId, onSuccess }: WhatsAppImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: 'Nessun file selezionato',
        description: 'Seleziona un file da importare',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/api/clients/${clientId}/communications/import`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante l\'importazione');
      }

      setUploadResult(result);

      if (result.imported > 0) {
        toast({
          title: '✅ Importazione completata',
          description: `${result.imported} messaggi importati con successo`
        });

        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: '⚠️ Nessun messaggio importato',
          description: result.skipped > 0 
            ? `Tutti i ${result.skipped} messaggi erano già presenti`
            : 'Nessun messaggio valido trovato nel file',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: '❌ Errore importazione',
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && !isUploading) {
        resetDialog();
      } else {
        setOpen(newOpen);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-import-whatsapp">
          <Upload className="w-4 h-4" />
          <span>Importa Chat WhatsApp</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Importa Conversazioni WhatsApp</DialogTitle>
          <DialogDescription>
            Carica un file di export WhatsApp per importare le conversazioni storiche.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!uploadResult ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-file">File Export WhatsApp</Label>
                <Input
                  id="whatsapp-file"
                  type="file"
                  accept=".txt,.json"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  data-testid="input-file-whatsapp"
                />
                <p className="text-xs text-muted-foreground">
                  Formati supportati: .txt (export WhatsApp) o .json
                </p>
              </div>

              {selectedFile && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    File selezionato: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Come esportare da WhatsApp:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal ml-4">
                  <li>Apri la chat WhatsApp da importare</li>
                  <li>Tocca i 3 puntini in alto a destra</li>
                  <li>Seleziona "Altro" → "Esporta chat"</li>
                  <li>Scegli "Senza media"</li>
                  <li>Salva il file e caricalo qui</li>
                </ol>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Alert className={uploadResult.imported > 0 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
                {uploadResult.imported > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      {uploadResult.imported > 0 
                        ? `✅ ${uploadResult.imported} messaggi importati con successo`
                        : '⚠️ Nessun messaggio importato'}
                    </p>
                    <div className="text-sm space-y-1">
                      <div>• Messaggi analizzati: {uploadResult.totalParsed}</div>
                      <div>• Messaggi duplicati saltati: {uploadResult.skipped}</div>
                      <div>• Righe totali nel file: {uploadResult.totalLines}</div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {uploadResult.parseErrors && uploadResult.parseErrors.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Avvisi di parsing:</p>
                    <ul className="text-xs space-y-1">
                      {uploadResult.parseErrors.map((error: string, idx: number) => (
                        <li key={idx} className="text-muted-foreground">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={resetDialog}
            disabled={isUploading}
            data-testid="button-cancel-import"
          >
            {uploadResult ? 'Chiudi' : 'Annulla'}
          </Button>
          {!uploadResult && (
            <Button
              onClick={handleImport}
              disabled={!selectedFile || isUploading}
              data-testid="button-confirm-import"
            >
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isUploading ? 'Importazione...' : 'Importa'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
