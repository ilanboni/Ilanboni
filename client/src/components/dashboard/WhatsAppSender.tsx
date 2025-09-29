import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, FileText, Image, Upload, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function WhatsAppSender() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCaption, setFileCaption] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (data: { phones: string[]; message: string }) => {
      if (data.phones.length === 1) {
        return apiRequest("/api/whatsapp/send-direct", {
          method: "POST",
          data: { to: data.phones[0], message: data.message }
        });
      } else {
        const results = [];
        for (const phone of data.phones) {
          try {
            const result = await apiRequest("/api/whatsapp/send-direct", {
              method: "POST",
              data: { to: phone, message: data.message }
            });
            results.push({ phone, success: true, result });
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            results.push({ phone, success: false, error: (error as any)?.message || 'Errore sconosciuto' });
          }
        }
        return results;
      }
    },
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        const successful = data.filter(r => r.success).length;
        const failed = data.filter(r => !r.success).length;
        
        if (failed === 0) {
          toast({
            title: "Messaggi inviati",
            description: `Tutti i ${successful} messaggi sono stati inviati con successo`,
          });
        } else {
          toast({
            title: "Invio completato",
            description: `${successful} messaggi inviati con successo, ${failed} non riusciti`,
            variant: failed > successful ? "destructive" : "default",
          });
        }
      } else {
        toast({
          title: "Messaggio inviato",
          description: "Il messaggio WhatsApp è stato inviato con successo",
        });
      }
      setPhone("");
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.message || "Errore nell'invio del messaggio",
        variant: "destructive",
      });
    },
  });

  // Helper per aggiungere informazioni di debug
  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  // Mutazione per inviare file
  const sendFileMutation = useMutation({
    mutationFn: async (data: { phones: string[]; file: File; caption: string }) => {
      console.log("📤 DEBUG: Inizio invio file a API", data.phones);
      addDebugInfo(`🚀 Inizio invio file: ${data.file.name} (${(data.file.size/1024).toFixed(1)}KB)`);
      
      if (data.phones.length === 1) {
        const formData = new FormData();
        formData.append('to', data.phones[0]);
        formData.append('file', data.file);
        if (data.caption) formData.append('caption', data.caption);

        console.log("🌐 DEBUG: Creazione FormData", {
          to: data.phones[0],
          fileName: data.file.name,
          fileSize: data.file.size,
          hasCaption: !!data.caption
        });

        addDebugInfo(`📤 Invio richiesta a ${data.phones[0]}`);

        // Usa apiRequest per consistenza
        return apiRequest("/api/whatsapp/send-file", {
          method: "POST",
          data: formData,
          headers: {
            // Non impostare Content-Type per FormData
          }
        });
      } else {
        const results = [];
        for (const phone of data.phones) {
          try {
            const formData = new FormData();
            formData.append('to', phone);
            formData.append('file', data.file);
            if (data.caption) formData.append('caption', data.caption);

            const response = await fetch('/api/whatsapp/send-file', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
              throw new Error(errorData.error || errorData.details || 'Errore nell\'invio del file');
            }
            const result = await response.json();
            results.push({ phone, success: true, result });
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (error) {
            results.push({ phone, success: false, error: (error as any)?.message || 'Errore sconosciuto' });
          }
        }
        return results;
      }
    },
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        const successful = data.filter(r => r.success).length;
        const failed = data.filter(r => !r.success).length;
        
        if (failed === 0) {
          toast({
            title: "File inviati",
            description: `Tutti i ${successful} file sono stati inviati con successo`,
          });
        } else {
          toast({
            title: "Invio completato",
            description: `${successful} file inviati con successo, ${failed} non riusciti`,
            variant: failed > successful ? "destructive" : "default",
          });
        }
      } else {
        toast({
          title: "File inviato",
          description: "Il file è stato inviato con successo via WhatsApp",
        });
      }
      setSelectedFile(null);
      setFileCaption("");
      setPhone("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.message || "Errore nell'invio del file",
        variant: "destructive",
      });
    },
  });

  // Funzioni per gestire i file
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validazione tipo file
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo file non supportato",
        description: "Sono supportati solo file PDF, JPG e PNG",
        variant: "destructive",
      });
      return;
    }

    // Validazione dimensione file (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File troppo grande",
        description: "Il file deve essere più piccolo di 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFileCaption("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const normalizePhoneNumber = (phoneStr: string): string => {
    let normalized = phoneStr.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    if (normalized.startsWith("0")) {
      normalized = "39" + normalized.substring(1);
    } else if (!normalized.startsWith("39") && !normalized.startsWith("+39")) {
      if (normalized.startsWith("+")) {
        normalized = normalized.substring(1);
      } else {
        normalized = "39" + normalized;
      }
    }
    return normalized;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      toast({
        title: "Numero di telefono obbligatorio",
        description: "Inserisci almeno un numero di telefono",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile && !message.trim()) {
      toast({
        title: "Contenuto obbligatorio",
        description: "Inserisci un messaggio o seleziona un file da inviare",
        variant: "destructive",
      });
      return;
    }

    let phoneNumbers: string[] = [];
    
    if (isBroadcast) {
      const rawNumbers = phone.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 0);
      
      if (rawNumbers.length === 0) {
        toast({
          title: "Numeri non validi",
          description: "Inserisci almeno un numero di telefono valido",
          variant: "destructive",
        });
        return;
      }
      
      phoneNumbers = rawNumbers.map(normalizePhoneNumber);
    } else {
      phoneNumbers = [normalizePhoneNumber(phone)];
    }

    // Se c'è un file, invia il file
    if (selectedFile) {
      console.log("🚀 DEBUG: Tentativo invio file", {
        phones: phoneNumbers,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      });
      sendFileMutation.mutate({
        phones: phoneNumbers,
        file: selectedFile,
        caption: fileCaption.trim()
      });
    } else {
      // Altrimenti invia solo il messaggio
      sendWhatsAppMutation.mutate({
        phones: phoneNumbers,
        message: message.trim()
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Invia WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="broadcast-mode"
              checked={isBroadcast}
              onCheckedChange={setIsBroadcast}
            />
            <Label htmlFor="broadcast-mode" className="text-sm">Invio multiplo</Label>
          </div>
          
          <div>
            <Label htmlFor="phone">
              {isBroadcast ? "Numeri di telefono" : "Numero di telefono"}
            </Label>
            {isBroadcast ? (
              <Textarea
                id="phone"
                placeholder="39334567890, 39335678901&#10;39336789012"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                rows={3}
                className="mt-1"
              />
            ) : (
              <Input
                id="phone"
                type="tel"
                placeholder="39334567890 o 334567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              {isBroadcast 
                ? "Inserisci i numeri separati da virgola o a capo"
                : "Inserisci il numero con prefisso internazionale (es: 393334567890)"
              }
            </p>
            {isBroadcast && phone && (
              <p className="text-xs text-blue-600 mt-1">
                Numeri: {phone.split(/[,\n]/).filter(p => p.trim().length > 0).length}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="message">Messaggio</Label>
            <Textarea
              id="message"
              placeholder="Scrivi il tuo messaggio..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>

          <Separator className="my-4" />

          {/* Sezione Upload File */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Allega File (Opzionale)</h4>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />

            {!selectedFile ? (
              <Button
                type="button"
                variant="outline"
                onClick={openFileSelector}
                className="w-full"
                data-testid="select-file"
              >
                <Upload className="mr-2 h-4 w-4" />
                Seleziona File (PDF, JPG, PNG)
              </Button>
            ) : (
              <div className="space-y-3">
                {/* Anteprima file selezionato */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(selectedFile)}
                    <div>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeSelectedFile}
                    className="text-red-500 hover:text-red-700"
                    data-testid="remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Campo didascalia */}
                <div>
                  <Label htmlFor="file-caption">Didascalia (Opzionale)</Label>
                  <Input
                    id="file-caption"
                    type="text"
                    placeholder="Aggiungi una didascalia al file..."
                    value={fileCaption}
                    onChange={(e) => setFileCaption(e.target.value)}
                    className="mt-1"
                    data-testid="file-caption"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Debug Info Panel */}
          {debugInfo.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
              <h5 className="text-xs font-semibold mb-2">Debug Info (ultimi 5):</h5>
              <div className="space-y-1 text-xs font-mono">
                {debugInfo.map((info, idx) => (
                  <div key={idx} className="text-gray-600 dark:text-gray-400">
                    {info}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDebugInfo([])}
                className="mt-2 text-xs"
              >
                Pulisci Debug
              </Button>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={sendWhatsAppMutation.isPending || sendFileMutation.isPending}
            className="w-full"
          >
            {(sendWhatsAppMutation.isPending || sendFileMutation.isPending) ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {selectedFile ? "Invio file..." : (isBroadcast ? "Invio broadcast..." : "Invio in corso...")}
              </>
            ) : (
              <>
                {selectedFile ? (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {isBroadcast ? "Invia File in Broadcast" : "Invia File"}
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {isBroadcast ? "Invia Broadcast" : "Invia Messaggio"}
                  </>
                )}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}