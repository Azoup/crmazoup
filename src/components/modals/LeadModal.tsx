import { useState, useEffect } from 'react';
import { Lead, LeadTemperature, LeadHistory } from '@/types/lead';
import { formatDateTime, getAISuggestion } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  XCircle, User, MessageCircle, Clock, Calendar, Trash2, Save, 
  Sparkles, ChevronRight, RefreshCw, CheckCircle, Loader2, FileText,
  Phone, Mail, StickyNote, History
} from 'lucide-react';

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onSave: (data: Partial<Lead>) => void;
  onDelete: (id: string) => void;
  addHistory: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
  msgTemplate: string;
  onUpdateTemplate: (template: string) => void;
}

const ACTIVITY_TYPES = [
  { id: 'ligacao', label: 'Ligação', icon: Phone, color: 'text-blue-500' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-500' },
  { id: 'email', label: 'Email', icon: Mail, color: 'text-orange-500' },
  { id: 'nota', label: 'Nota', icon: StickyNote, color: 'text-purple-500' },
];

export function LeadModal({ lead, onClose, onSave, onDelete, addHistory, msgTemplate, onUpdateTemplate }: LeadModalProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [showLossModal, setShowLossModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(msgTemplate);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '', company: '', confection_type: '', whatsapp: '', email: '',
    temperature: 'morno', value: 0, next_contact: '', stage: 'prospeccao',
    meeting_pain: '', meeting_link: '', meeting_date: '', history: []
  });

  useEffect(() => {
    if (lead) {
      setFormData(lead);
    } else {
      setFormData({
        name: '', company: '', confection_type: '', whatsapp: '', email: '',
        temperature: 'morno', value: 0, next_contact: '', stage: 'prospeccao',
        meeting_pain: '', meeting_link: '', meeting_date: '', history: []
      });
    }
    setNoteText('');
    setCurrentTemplate(msgTemplate);
  }, [lead, msgTemplate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'value' ? Number(value) : value }));
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const suggestNextContact = () => {
    const nextDate = new Date();
    if (formData.stage === 'prospeccao') nextDate.setDate(nextDate.getDate() + 2);
    else if (formData.stage === 'interesse') nextDate.setDate(nextDate.getDate() + 3);
    else if (formData.stage === 'reuniao') nextDate.setDate(nextDate.getDate() + 1);
    setFormData(prev => ({ ...prev, next_contact: nextDate.toISOString().split('T')[0] }));
  };

  const markAsLost = (reason: string) => {
    onSave({ ...formData, stage: 'perdidos', loss_reason: reason });
    setShowLossModal(false);
  };

  const reactivate = () => {
    if (confirm("Reativar lead e mover para Prospecção?")) {
      const newHistory: LeadHistory = { type: 'sistema', note: '🔄 Lead Reativado', date: new Date().toISOString(), user: profile?.name.split(' ')[0] || 'Sistema' };
      onSave({ ...formData, stage: 'prospeccao', history: [newHistory, ...(formData.history || [])] });
    }
  };

  const handleRegisterActivity = async (type: string) => {
    if (!lead) return;
    if (!noteText.trim()) {
      return;
    }
    const updatedHistory = await addHistory(lead.id, type, noteText.trim());
    if (updatedHistory) {
      // Update local formData with the new history
      setFormData(prev => ({ ...prev, history: updatedHistory }));
      setNoteText('');
    }
  };

  const cleanPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  };

  const sendWhatsApp = async () => {
    if (!formData.whatsapp) { 
      alert("Adicione um número de WhatsApp primeiro."); 
      return; 
    }
    
    let finalMsg = currentTemplate
      .replace(/{nome}/gi, formData.name || "")
      .replace(/{empresa}/gi, formData.company || "")
      .replace(/{tipo}/gi, formData.confection_type || "");
    
    if (profile?.signature) finalMsg += `\n\n${profile.signature}`;
    
    const phone = cleanPhoneNumber(formData.whatsapp);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(finalMsg)}`;
    
    // Open WhatsApp first
    window.open(whatsappUrl, '_blank');
    
    // Then register in history
    if (lead) {
      const updatedHistory = await addHistory(lead.id, 'whatsapp', `📱 Mensagem enviada via WhatsApp: "${finalMsg.substring(0, 100)}${finalMsg.length > 100 ? '...' : ''}"`);
      if (updatedHistory) {
        setFormData(prev => ({ ...prev, history: updatedHistory }));
      }
    }
  };

  const handleGenerateMessage = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: 'whatsapp', lead: formData }),
      });
      const data = await response.json();
      if (data.message) { 
        setCurrentTemplate(data.message); 
        onUpdateTemplate(data.message); 
      }
    } catch (e) { 
      console.error('AI error:', e); 
    }
    setIsGenerating(false);
  };

  const handleSaveTemplate = () => {
    onUpdateTemplate(currentTemplate);
  };

  const getActivityIcon = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.id === type);
    if (activity) return <activity.icon size={14} className={activity.color} />;
    if (type === 'stage_change') return <ChevronRight size={14} className="text-primary" />;
    if (type === 'criacao') return <Sparkles size={14} className="text-yellow-500" />;
    if (type === 'sistema') return <RefreshCw size={14} className="text-muted-foreground" />;
    return <History size={14} className="text-muted-foreground" />;
  };

  const tabs = [
    { id: 'info', label: 'Dados', icon: User },
    ...(lead ? [
      { id: 'actions', label: 'Ações', icon: MessageCircle },
      { id: 'history', label: 'Histórico', icon: History },
      { id: 'meeting', label: 'Reunião', icon: Calendar },
    ] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-card w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        <div className="bg-foreground text-background p-4 md:p-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              {lead ? formData.name : 'Novo Lead'}
              {lead && <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${formData.temperature === 'quente' ? 'bg-temp-hot text-white' : formData.temperature === 'morno' ? 'bg-temp-warm text-white' : 'bg-temp-cold text-white'}`}>{formData.temperature}</span>}
            </h2>
            <p className="text-background/60 text-sm">{formData.company || 'Nova Empresa'}</p>
          </div>
          <button onClick={onClose} className="text-background/60 hover:text-background"><XCircle size={28} /></button>
        </div>

        {lead && (
          <div className="bg-accent border-b border-border p-3 flex items-start gap-3 flex-shrink-0">
            <Sparkles className="text-primary mt-1 flex-shrink-0" size={18} />
            <div className="overflow-hidden">
              <p className="text-accent-foreground text-sm font-medium">Sugestão Azoup AI:</p>
              <p className="text-accent-foreground/80 text-xs">{getAISuggestion({ stage: formData.stage || 'prospeccao', confection_type: formData.confection_type })}</p>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          <div className="w-full md:w-48 bg-muted border-r border-border p-2 flex flex-row md:flex-col gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`p-3 text-sm flex items-center gap-2 rounded transition ${activeTab === tab.id ? 'bg-card text-primary shadow' : 'text-muted-foreground hover:bg-card/50'}`}>
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
            {lead && <button onClick={() => onDelete(lead.id)} className="md:mt-auto p-3 text-sm flex items-center gap-2 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={16} /> Excluir</button>}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-card scrollbar-thin">
            {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Nome do lead" />
                  </div>
                  <div>
                    <Label>Empresa</Label>
                    <Input name="company" value={formData.company || ''} onChange={handleChange} placeholder="Nome da empresa" />
                  </div>
                  <div>
                    <Label>Tipo Confecção</Label>
                    <Input name="confection_type" value={formData.confection_type || ''} onChange={handleChange} placeholder="Ex: Moda Fitness, Uniformes" />
                  </div>
                  <div className="bg-info/10 p-2 rounded border border-info/20">
                    <Label className="text-info">Próximo Contato</Label>
                    <div className="flex gap-2">
                      <Input type="date" name="next_contact" value={formData.next_contact || ''} onChange={handleChange} />
                      <Button variant="outline" size="sm" onClick={suggestNextContact} title="Sugerir data">✨</Button>
                    </div>
                  </div>
                  <div>
                    <Label>WhatsApp (com DDD)</Label>
                    <Input name="whatsapp" value={formData.whatsapp || ''} onChange={handleChange} placeholder="11999999999" />
                    {formData.whatsapp && <p className="text-[10px] text-success mt-1 flex items-center gap-1"><CheckCircle size={10} /> wa.me/55{formData.whatsapp.replace(/\D/g, '')}</p>}
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="email@empresa.com" />
                  </div>
                  <div>
                    <Label>Valor Estimado (R$)</Label>
                    <Input type="number" name="value" value={formData.value || 0} onChange={handleChange} min={0} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Status Térmico</Label>
                    <div className="flex gap-4 mt-1">
                      {(['frio', 'morno', 'quente'] as LeadTemperature[]).map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="temperature" value={t} checked={formData.temperature === t} onChange={handleChange} className="text-primary" />
                          <span className={`capitalize text-sm font-medium ${t === 'quente' ? 'text-temp-hot' : t === 'morno' ? 'text-temp-warm' : 'text-temp-cold'}`}>{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'actions' && lead && (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg border border-border flex justify-between items-center flex-wrap gap-2">
                  <div><span className="text-xs text-muted-foreground uppercase font-bold">Estágio:</span><p className="font-bold text-lg text-primary capitalize">{formData.stage}</p></div>
                  <div className="flex gap-2">
                    {formData.stage === 'congelados' ? (
                      <Button onClick={reactivate} variant="outline"><RefreshCw size={16} className="mr-2" /> Reativar</Button>
                    ) : (
                      <>
                        {!['venda', 'perdidos'].includes(formData.stage || '') && (
                          <Button onClick={() => {
                            const next: Record<string, string> = { prospeccao: 'interesse', interesse: 'reuniao', reuniao: 'venda' };
                            if (next[formData.stage || '']) onSave({ ...formData, stage: next[formData.stage || ''] as any });
                          }}>Avançar <ChevronRight size={16} /></Button>
                        )}
                        {!['perdidos', 'venda'].includes(formData.stage || '') && (
                          <Button variant="outline" onClick={() => setShowLossModal(true)} className="text-destructive border-destructive/30">Marcar Perdido</Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="border border-success/30 bg-success/5 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-success flex items-center gap-2"><MessageCircle size={18} /> WhatsApp Personalizado</h3>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={handleGenerateMessage} disabled={isGenerating} className="text-success">
                        {isGenerating ? <Loader2 className="animate-spin mr-1" size={12} /> : <Sparkles size={12} className="mr-1" />} Gerar com IA
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleSaveTemplate} className="text-muted-foreground">
                        <Save size={12} className="mr-1" /> Salvar Template
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Use {'{nome}'}, {'{empresa}'}, {'{tipo}'} para personalização</p>
                  <Textarea 
                    className="mb-2" 
                    rows={3} 
                    value={currentTemplate} 
                    onChange={(e) => setCurrentTemplate(e.target.value)} 
                    placeholder="Olá {nome}, vi que você trabalha com {tipo}..."
                  />
                  <Button onClick={sendWhatsApp} className="bg-success hover:bg-success/90">Enviar WhatsApp</Button>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2"><FileText size={18} /> Registrar Atividade</h3>
                  <Textarea 
                    className="mb-3" 
                    rows={3} 
                    placeholder="Descreva o que aconteceu neste contato..." 
                    value={noteText} 
                    onChange={(e) => setNoteText(e.target.value)} 
                  />
                  <div className="flex flex-wrap gap-2">
                    {ACTIVITY_TYPES.map(type => (
                      <Button 
                        key={type.id} 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRegisterActivity(type.id)} 
                        disabled={!noteText.trim()}
                        className="flex items-center gap-2"
                      >
                        <type.icon size={14} className={type.color} />
                        {type.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && lead && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <History size={18} /> Linha do Tempo Completa
                  </h3>
                  <span className="text-xs text-muted-foreground">{formData.history?.length || 0} registros</span>
                </div>
                
                {(!formData.history || formData.history.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Nenhum histórico registrado ainda.</p>
                    <p className="text-xs">Use a aba "Ações" para registrar atividades.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-primary/30 space-y-4">
                    {formData.history.map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className={`absolute -left-[25px] top-2 w-4 h-4 rounded-full flex items-center justify-center ${
                          item.type === 'stage_change' ? 'bg-primary ring-4 ring-primary/20' : 
                          item.type === 'criacao' ? 'bg-yellow-500 ring-4 ring-yellow-500/20' :
                          'bg-card border-2 border-muted-foreground/50'
                        }`}>
                          {getActivityIcon(item.type)}
                        </div>
                        <div className="bg-card p-4 border rounded-lg shadow-sm ml-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-muted">
                              {item.type.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(item.date)}
                            </span>
                          </div>
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{item.note}</p>
                          <div className="mt-2 pt-2 border-t border-border">
                            <span className="text-xs text-muted-foreground">por: <span className="font-medium text-foreground">{item.user}</span></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'meeting' && (
              <div className="space-y-4">
                <div>
                  <Label>Dores / Necessidades do Cliente</Label>
                  <Textarea name="meeting_pain" value={formData.meeting_pain || ''} onChange={handleChange} rows={4} placeholder="Quais são as principais dores e necessidades identificadas?" />
                </div>
                <div>
                  <Label>Link da Reunião</Label>
                  <Input name="meeting_link" value={formData.meeting_link || ''} onChange={handleChange} placeholder="https://meet.google.com/..." />
                </div>
                <div>
                  <Label>Data e Hora da Reunião</Label>
                  <Input type="datetime-local" name="meeting_date" value={formData.meeting_date || ''} onChange={handleChange} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-muted flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.name?.trim()}>
            {isSaving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
            {lead ? 'Salvar' : 'Criar Lead'}
          </Button>
        </div>

        {showLossModal && (
          <div className="absolute inset-0 bg-card/95 z-50 flex flex-col items-center justify-center p-8">
            <h3 className="text-xl font-bold text-foreground mb-4">Qual o motivo da perda?</h3>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              {['Preço', 'Sem Interesse', 'Já possui sistema', 'Não Responde', 'Outro'].map(reason => (
                <Button key={reason} variant="outline" onClick={() => markAsLost(reason)}>{reason}</Button>
              ))}
            </div>
            <button onClick={() => setShowLossModal(false)} className="mt-6 text-muted-foreground hover:text-foreground underline">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}
