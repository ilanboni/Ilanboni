import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Trash2, 
  Plus, 
  Send, 
  CheckCircle, 
  AlertCircle,
  Upload,
  Calendar,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface MailMergeContact {
  id: string;
  appellativo: string;
  cognome: string;
  indirizzo: string;
  telefono: string;
  vistoSu: string;
  caratteristiche: string;
  status?: 'pending' | 'sent' | 'duplicate' | 'error';
  message?: string;
}

const DEFAULT_MESSAGE_TEMPLATE = `Buongiorno <<Appellativo>> <<Cognome>>,

ho visto l'annuncio del suo appartamento su <<Visto su>> e sono rimasto colpito in particolare da <<Caratteristiche particolari>>.

Mi chiamo Ilan Boni, titolare di Cavour Immobiliare a Milano.
Lo scorso anno ho concluso 16 vendite, alcune proprio con proprietari privati come Lei: all'inizio scettici, ma alla fine soddisfatti per aver venduto al prezzo giusto e senza rischi.

Per spiegare meglio il mio metodo, Le invio un breve video di presentazione.
Clicca qui per vederlo: https://youtube.com/shorts/Qf_9SfWfeGg?si=h80cJH2eJjkiOg8a

Così può farsi subito un'idea di chi sono e di come lavoro.

Se pensa che ci siano le condizioni, possiamo sentirci senza impegno.

Cordiali saluti,
Ilan Boni – Cavour Immobiliare`;

export default function MailMergePage() {
  const [contacts, setContacts] = useState<MailMergeContact[]>([
    {
      id: 'example-1',
      appellativo: 'Gent.mo Sig.',
      cognome: 'Rossi',
      indirizzo: 'Via Roma 15, Milano',
      telefono: '+39 335 1234567',
      vistoSu: 'Immobiliare.it',
      caratteristiche: 'terrazzo panoramico e doppi servizi',
      status: 'pending'
    },
    {
      id: 'example-2',
      appellativo: 'Egr. Dott.',
      cognome: 'Bianchi',
      indirizzo: 'Corso Buenos Aires 78, Milano',
      telefono: '+39 347 9876543',
      vistoSu: 'Casa.it',
      caratteristiche: 'ampio soggiorno e cucina abitabile',
      status: 'pending'
    }
  ]);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'analytics'>('compose');
  const { toast } = useToast();

  // Fetch mail merge history
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['/api/mail-merge/history'],
    enabled: activeTab === 'history'
  });

  // Fetch mail merge analytics
  const { data: analyticsData, refetch: refetchAnalytics } = useQuery({
    queryKey: ['/api/mail-merge/analytics'],
    enabled: activeTab === 'analytics'
  });

  // Add new empty contact
  const addContact = () => {
    const newContact: MailMergeContact = {
      id: Date.now().toString(),
      appellativo: '',
      cognome: '',
      indirizzo: '',
      telefono: '',
      vistoSu: '',
      caratteristiche: '',
      status: 'pending'
    };
    setContacts([...contacts, newContact]);
  };

  // Update contact field
  const updateContact = (id: string, field: keyof MailMergeContact, value: string) => {
    setContacts(contacts.map(contact => 
      contact.id === id 
        ? { ...contact, [field]: value, status: 'pending' }
        : contact
    ));
  };

  // Remove contact
  const removeContact = (id: string) => {
    setContacts(contacts.filter(contact => contact.id !== id));
  };

  // Generate personalized message for a contact
  const generateMessage = (contact: MailMergeContact): string => {
    return messageTemplate
      .replace(/<<Appellativo>>/g, contact.appellativo)
      .replace(/<<Cognome>>/g, contact.cognome)
      .replace(/<<Indirizzo>>/g, contact.indirizzo)
      .replace(/<<Visto su>>/g, contact.vistoSu)
      .replace(/<<Caratteristiche particolari>>/g, contact.caratteristiche);
  };

  // Validate contact data
  const validateContact = (contact: MailMergeContact): string | null => {
    if (!contact.appellativo.trim()) return "Appellativo mancante";
    if (!contact.cognome.trim()) return "Cognome mancante";
    if (!contact.indirizzo.trim()) return "Indirizzo mancante";
    if (!contact.telefono.trim()) return "Numero di telefono mancante";
    if (!contact.vistoSu.trim()) return "Campo 'Visto su' mancante";
    if (!contact.caratteristiche.trim()) return "Caratteristiche mancanti";
    
    // Basic phone validation
    const phoneRegex = /^[+]?[0-9\s\-()]{8,}$/;
    if (!phoneRegex.test(contact.telefono)) {
      return "Formato numero di telefono non valido";
    }
    
    return null;
  };

  // Send messages to all contacts
  const sendMessages = async () => {
    if (contacts.length === 0) {
      toast({
        title: "Errore",
        description: "Aggiungi almeno un contatto prima di inviare",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    try {
      for (const contact of contacts) {
        // Validate contact
        const validationError = validateContact(contact);
        if (validationError) {
          setContacts(prev => prev.map(c => 
            c.id === contact.id 
              ? { ...c, status: 'error', message: validationError }
              : c
          ));
          errorCount++;
          continue;
        }

        try {
          // Generate personalized message
          const personalizedMessage = generateMessage(contact);

          // Send mail merge request
          const response = await apiRequest('/api/mail-merge/send', {
            method: 'POST',
            data: {
              appellativo: contact.appellativo,
              cognome: contact.cognome,
              indirizzo: contact.indirizzo,
              telefono: contact.telefono,
              vistoSu: contact.vistoSu,
              caratteristiche: contact.caratteristiche,
              message: personalizedMessage
            }
          });

          if (response && typeof response === 'object' && 'success' in response && response.success) {
            if ('isDuplicate' in response && response.isDuplicate) {
              setContacts(prev => prev.map(c => 
                c.id === contact.id 
                  ? { ...c, status: 'duplicate', message: 'Cliente già presente o messaggio già inviato' }
                  : c
              ));
              duplicateCount++;
            } else {
              setContacts(prev => prev.map(c => 
                c.id === contact.id 
                  ? { ...c, status: 'sent', message: 'Messaggio inviato con successo' }
                  : c
              ));
              successCount++;
            }
          } else {
            const errorMessage = (response && typeof response === 'object' && 'message' in response) 
              ? response.message as string 
              : 'Errore sconosciuto';
            setContacts(prev => prev.map(c => 
              c.id === contact.id 
                ? { ...c, status: 'error', message: errorMessage }
                : c
            ));
            errorCount++;
          }
        } catch (error) {
          setContacts(prev => prev.map(c => 
            c.id === contact.id 
              ? { ...c, status: 'error', message: 'Errore durante l\'invio' }
              : c
          ));
          errorCount++;
        }

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Show summary
      toast({
        title: "Invio completato",
        description: `Inviati: ${successCount}, Errori: ${errorCount}, Duplicati: ${duplicateCount}`,
        variant: successCount > 0 ? "default" : "destructive"
      });

    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore durante l'invio dei messaggi",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
      // Refresh analytics after sending
      if (activeTab === 'analytics') {
        refetchAnalytics();
      }
    }
  };

  // Aggiungi righe vuote per facilitare l'inserimento
  const addMultipleRows = (count: number = 5) => {
    const newContacts: MailMergeContact[] = [];
    for (let i = 0; i < count; i++) {
      newContacts.push({
        id: `new-${Date.now()}-${i}`,
        appellativo: '',
        cognome: '',
        indirizzo: '',
        telefono: '',
        vistoSu: '',
        caratteristiche: '',
        status: 'pending'
      });
    }
    setContacts([...contacts, ...newContacts]);
  };

  // Parse CSV-like input (manteniamo per compatibilità)
  const parseContacts = (text: string) => {
    const lines = text.trim().split('\n');
    const newContacts: MailMergeContact[] = [];

    lines.forEach((line, index) => {
      const parts = line.split('\t'); // Tab-separated
      if (parts.length >= 6) {
        newContacts.push({
          id: `imported-${Date.now()}-${index}`,
          appellativo: parts[0]?.trim() || '',
          cognome: parts[1]?.trim() || '',
          indirizzo: parts[2]?.trim() || '',
          telefono: parts[3]?.trim() || '',
          vistoSu: parts[4]?.trim() || '',
          caratteristiche: parts[5]?.trim() || '',
          status: 'pending'
        });
      }
    });

    if (newContacts.length > 0) {
      setContacts([...contacts, ...newContacts]);
      toast({
        title: "Importazione completata",
        description: `Importati ${newContacts.length} contatti`
      });
    }
  };

  // Get status badge
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle size={12} className="mr-1" />Inviato</Badge>;
      case 'duplicate':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle size={12} className="mr-1" />Duplicato</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle size={12} className="mr-1" />Errore</Badge>;
      default:
        return <Badge variant="outline">In attesa</Badge>;
    }
  };

  // Update response status for a message
  const updateResponseStatus = async (messageId: number, responseStatus: 'positive' | 'negative' | 'no_response', responseText?: string) => {
    try {
      await apiRequest(`/api/mail-merge/response/${messageId}`, {
        method: 'PUT',
        data: { responseStatus, responseText }
      });
      refetchHistory();
      refetchAnalytics();
      toast({
        title: "Successo",
        description: "Stato risposta aggiornato",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dello stato",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mail Merge Proprietari Privati</h1>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'compose', label: 'Componi Messaggi', icon: Send },
            { id: 'history', label: 'Cronologia Invii', icon: Clock },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button 
                onClick={addContact}
                variant="outline"
                size="sm"
              >
                <Plus size={16} className="mr-2" />
                +1 Riga
              </Button>
              <Button 
                onClick={() => addMultipleRows(5)}
                variant="outline"
                size="sm"
              >
                <Plus size={16} className="mr-2" />
                +5 Righe
              </Button>
            </div>
            <Button 
              onClick={sendMessages}
              disabled={isSending || contacts.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send size={16} className="mr-2" />
              {isSending ? 'Invio in corso...' : 'Invia Tutti'}
            </Button>
          </div>

      {/* Message Template */}
      <Card>
        <CardHeader>
          <CardTitle>Template Messaggio</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            rows={15}
            className="font-mono text-sm"
            placeholder="Template del messaggio con segnaposto..."
          />
          <p className="text-sm text-gray-500 mt-2">
            Usa i segnaposto: {'<<Appellativo>>'}, {'<<Cognome>>'}, {'<<Visto su>>'}, {'<<Caratteristiche particolari>>'}
          </p>
        </CardContent>
      </Card>

      {/* Helper Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload size={16} className="mr-2" />
            Gestione Contatti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Azioni Rapide</Label>
              <div className="flex gap-2">
                <Button 
                  onClick={() => addMultipleRows(10)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  +10 Righe
                </Button>
                <Button 
                  onClick={() => setContacts([])}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Pulisci Tutto
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Importa da Excel/CSV</Label>
              <Textarea
                placeholder="Incolla qui i dati separati da tabulazioni"
                onChange={(e) => {
                  if (e.target.value.trim()) {
                    parseContacts(e.target.value);
                    e.target.value = '';
                  }
                }}
                rows={2}
                className="text-xs"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Formato Template</Label>
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                Appellativo → Cognome → Indirizzo<br />
                → Telefono → Visto su → Caratteristiche
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contatti ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Appellativo</TableHead>
                  <TableHead className="w-32">Cognome</TableHead>
                  <TableHead className="w-48">Indirizzo</TableHead>
                  <TableHead className="w-32">Telefono</TableHead>
                  <TableHead className="w-28">Visto su</TableHead>
                  <TableHead className="w-48">Caratteristiche</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-16">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact, index) => (
                  <TableRow key={contact.id} className={index % 2 === 0 ? "bg-gray-50/50" : ""}>
                    <TableCell>
                      <Select
                        value={contact.appellativo}
                        onValueChange={(value) => updateContact(contact.id, 'appellativo', value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Seleziona..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Gentile">Gentile</SelectItem>
                          <SelectItem value="Egr. Dott.">Egr. Dott.</SelectItem>
                          <SelectItem value="Gent.mo Sig.">Gent.mo Sig.</SelectItem>
                          <SelectItem value="Gent.ma Sig.ra">Gent.ma Sig.ra</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={contact.cognome}
                        onChange={(e) => updateContact(contact.id, 'cognome', e.target.value)}
                        placeholder="Rossi"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={contact.indirizzo}
                        onChange={(e) => updateContact(contact.id, 'indirizzo', e.target.value)}
                        placeholder="Via Roma 1, Milano"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={contact.telefono}
                        onChange={(e) => updateContact(contact.id, 'telefono', e.target.value)}
                        placeholder="+39 335 1234567"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={contact.vistoSu}
                        onChange={(e) => updateContact(contact.id, 'vistoSu', e.target.value)}
                        placeholder="Immobiliare.it"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={contact.caratteristiche}
                        onChange={(e) => updateContact(contact.id, 'caratteristiche', e.target.value)}
                        placeholder="terrazzo panoramico"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getStatusBadge(contact.status)}
                        {contact.message && (
                          <p className="text-xs text-gray-500 max-w-20 truncate" title={contact.message}>
                            {contact.message}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContact(contact.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Riga vuota finale per aggiungere facilmente nuovi contatti */}
                <TableRow className="border-2 border-dashed border-gray-200 hover:border-gray-300">
                  <TableCell colSpan={8} className="text-center py-4">
                    <Button 
                      onClick={addContact}
                      variant="ghost"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Plus size={16} className="mr-2" />
                      Aggiungi nuovo contatto
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          {contacts.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun contatto inserito</h3>
              <p className="text-gray-500 mb-4">
                Inizia aggiungendo dei contatti utilizzando i pulsanti sopra o modificando gli esempi precompilati.
              </p>
              <Button onClick={() => addMultipleRows(5)}>
                <Plus size={16} className="mr-2" />
                Aggiungi 5 Righe
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Cronologia Invii Mail Merge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyData?.data ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Invio</TableHead>
                        <TableHead>Proprietario</TableHead>
                        <TableHead>Indirizzo</TableHead>
                        <TableHead>Telefono</TableHead>
                        <TableHead>Stato Risposta</TableHead>
                        <TableHead>Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.data.map((message: any) => (
                        <TableRow key={message.id}>
                          <TableCell>
                            {new Date(message.sentAt).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>
                            {message.appellativo} {message.cognome}
                          </TableCell>
                          <TableCell>{message.indirizzo}</TableCell>
                          <TableCell>{message.telefono}</TableCell>
                          <TableCell>
                            <Select
                              value={message.responseStatus}
                              onValueChange={(value) => updateResponseStatus(message.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no_response">
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                                    Nessuna risposta
                                  </div>
                                </SelectItem>
                                <SelectItem value="positive">
                                  <div className="flex items-center">
                                    <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />
                                    Positiva
                                  </div>
                                </SelectItem>
                                <SelectItem value="negative">
                                  <div className="flex items-center">
                                    <ThumbsDown className="h-4 w-4 mr-2 text-red-500" />
                                    Negativa
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(message.telefono);
                                toast({ title: "Numero copiato", description: "Numero di telefono copiato negli appunti" });
                              }}
                            >
                              Copia Tel.
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Nessuna cronologia disponibile</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analyticsData?.data && (
            <>
              {/* Daily Goal Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Obiettivo Giornaliero
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {analyticsData.data.today.sent}
                      </div>
                      <div className="text-sm text-gray-500">Messaggi Inviati Oggi</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {analyticsData.data.today.goal}
                      </div>
                      <div className="text-sm text-gray-500">Obiettivo Giornaliero</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {analyticsData.data.today.remaining}
                      </div>
                      <div className="text-sm text-gray-500">Rimanenti</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(100, (analyticsData.data.today.sent / analyticsData.data.today.goal) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {Math.round((analyticsData.data.today.sent / analyticsData.data.today.goal) * 100)}% completato
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Response Analytics Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Statistiche Risposte
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {analyticsData.data.responses.total}
                      </div>
                      <div className="text-sm text-gray-500">Totale Messaggi</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {analyticsData.data.responses.positive}
                      </div>
                      <div className="text-sm text-gray-500">Risposte Positive</div>
                      <div className="text-xs font-medium text-green-600">
                        {analyticsData.data.percentages.positive}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {analyticsData.data.responses.negative}
                      </div>
                      <div className="text-sm text-gray-500">Risposte Negative</div>
                      <div className="text-xs font-medium text-red-600">
                        {analyticsData.data.percentages.negative}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">
                        {analyticsData.data.responses.noResponse}
                      </div>
                      <div className="text-sm text-gray-500">Nessuna Risposta</div>
                      <div className="text-xs font-medium text-gray-600">
                        {analyticsData.data.percentages.noResponse}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Visual Progress Bars */}
                  <div className="mt-6 space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Risposte Positive</span>
                        <span>{analyticsData.data.percentages.positive}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${analyticsData.data.percentages.positive}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Risposte Negative</span>
                        <span>{analyticsData.data.percentages.negative}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${analyticsData.data.percentages.negative}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}