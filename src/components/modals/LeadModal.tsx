import { useState, useEffect, useCallback, useRef } from 'react';
import { Lead, LeadTemperature, LeadHistory, LeadSource } from '@/types/lead';
import { formatDateTime, getAISuggestion } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  XCircle, User, MessageCircle, Calendar, Trash2, Save, 
  Sparkles, ChevronRight, ChevronDown, RefreshCw, CheckCircle, Loader2, FileText, Megaphone,
  Phone, Mail, StickyNote, History, UserCheck
} from 'lucide-react';
import {
  mapAcImportToLead,
  needsActiveCampaignMarketingFetch,
  parseActiveCampaignContactId,
  type AcImportPreview,
  type AcImportRaw,
} from '@/lib/activecampaignMap';
import { getFunctionInvokeErrorMessage } from '@/lib/supabaseFunctionError';

interface LeadModalProps {
  lead: Lead | null;
  draftScope?: LeadSource;
  onClose: () => void;
  onSave: (data: Partial<Lead>) => Promise<boolean>;
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

export function LeadModal({ lead, draftScope = 'marketing', onClose, onSave, onDelete, addHistory, msgTemplate, onUpdateTemplate }: LeadModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('info');
  const [showLossModal, setShowLossModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeDate, setFreezeDate] = useState('');
  const [noteText, setNoteText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingObjection, setIsGeneratingObjection] = useState(false);
  const [objectionText, setObjectionText] = useState('');
  const [objectionResponses, setObjectionResponses] = useState<string[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState(msgTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const [managerProfile, setManagerProfile] = useState<{ user_id: string; name: string } | null>(null);
  const [isDebuggingAc, setIsDebuggingAc] = useState(false);
  const [isImportingAc, setIsImportingAc] = useState(false);
  const [acLinkInput, setAcLinkInput] = useState('');
  const [acDebugResult, setAcDebugResult] = useState<null | (AcImportPreview & { raw: unknown })>(null);
  const acAutoFetchKeyRef = useRef<string | null>(null);

  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '', company: '', confection_type: '', whatsapp: '', email: '',
    temperature: 'frio', value: 0, implementation_value: 0, monthly_value: 0,
    next_contact: '', stage: 'prospeccao',
    meeting_pain: '', meeting_link: '', meeting_date: '', history: [],
    pieces_per_month: null, responsible_user_id: null,
    utm_source: null, utm_campaign: null, utm_medium: null, utm_conjunto: null,
  });
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Fetch the manager who manages this SDR (if any)
  useEffect(() => {
    const fetchManager = async () => {
      if (!user) return;
      try {
        const { data: relations } = await supabase
          .from('manager_sdr_relations')
          .select('manager_id')
          .eq('sdr_id', user.id)
          .limit(1);
        
        if (relations && relations.length > 0) {
          const managerId = relations[0].manager_id;
          const { data: mgrProfile } = await supabase
            .from('profiles')
            .select('user_id, name')
            .eq('user_id', managerId)
            .maybeSingle();
          
          if (mgrProfile) {
            setManagerProfile(mgrProfile);
          }
        }
      } catch (err) {
        console.error('Error fetching manager:', err);
      }
    };
    fetchManager();
  }, [user]);

  // Persist drafts in localStorage so data survives browser tab/window switches
  const draftIdentity = lead?.id ? `lead-${lead.id}` : `new-${draftScope}`;
  const draftKey = `lead-draft-${draftIdentity}`;
  const noteDraftKey = `lead-note-draft-${draftIdentity}`;
  const tabKey = `lead-tab-${draftIdentity}`;

  const emptyLeadDraft: Partial<Lead> = {
    name: '', company: '', confection_type: '', whatsapp: '', email: '',
    temperature: 'frio', value: 0, implementation_value: 0, monthly_value: 0,
    next_contact: '', stage: 'prospeccao',
    meeting_pain: '', meeting_link: '', meeting_date: '', history: [],
    pieces_per_month: null, responsible_user_id: null,
    utm_source: null, utm_campaign: null, utm_medium: null, utm_conjunto: null,
  };

  // Track previous draft identity to only reset form when switching lead/source
  const [prevDraftIdentity, setPrevDraftIdentity] = useState<string | null>(null);

  useEffect(() => {
    const isDraftChanged = draftIdentity !== prevDraftIdentity;

    if (isDraftChanged) {
      setPrevDraftIdentity(draftIdentity);
      const savedTab = localStorage.getItem(tabKey);
      setActiveTab(savedTab || 'info');
    }

    const savedDraft = localStorage.getItem(draftKey);
    const savedNote = localStorage.getItem(noteDraftKey);

    if (lead) {
      if (isDraftChanged) {
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setFormData({ ...lead, ...parsed, history: lead.history });
          } catch {
            setFormData(lead);
          }
        } else {
          setFormData(lead);
        }
        setNoteText(savedNote || '');
      } else {
        setFormData(prev => ({ ...prev, history: lead.history }));
      }
      if (lead.activecampaign_id) {
        setAcLinkInput(`https://azouptecnologia.activehosted.com/app/contacts/${lead.activecampaign_id}`);
      } else {
        setAcLinkInput('');
      }
      return;
    }

    if (!isDraftChanged) return;

    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData({ ...emptyLeadDraft, ...parsed });
      } catch {
        setFormData(emptyLeadDraft);
      }
    } else {
      setFormData(emptyLeadDraft);
    }
    setNoteText(savedNote || '');
  }, [lead, draftIdentity, draftKey, noteDraftKey, tabKey, prevDraftIdentity]);

  // Save formData draft to localStorage on changes
  useEffect(() => {
    if (draftKey) {
      const { history, ...draftData } = formData;
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    }
  }, [formData, draftKey]);

  // Save noteText draft to localStorage on changes
  useEffect(() => {
    if (noteDraftKey) {
      localStorage.setItem(noteDraftKey, noteText);
    }
  }, [noteText, noteDraftKey]);

  // Save active tab to localStorage
  useEffect(() => {
    if (tabKey) {
      localStorage.setItem(tabKey, activeTab);
    }
  }, [activeTab, tabKey]);

  useEffect(() => {
    setCurrentTemplate(msgTemplate);
  }, [msgTemplate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['value', 'implementation_value', 'monthly_value', 'pieces_per_month'];
    setFormData(prev => ({ ...prev, [name]: numericFields.includes(name) ? (value === '' ? null : Number(value)) : value }));
  };

  const resolveAcContactId = (): string | null => {
    const fromLink = parseActiveCampaignContactId(acLinkInput);
    if (fromLink) return fromLink;
    if (lead?.activecampaign_id) return String(lead.activecampaign_id);
    return null;
  };

  const fetchAcContactData = async (acId: string) => {
    const id = String(acId);

    if (import.meta.env.DEV) {
      try {
        const local = await fetch(`/api/ac-import/${encodeURIComponent(id)}`);
        const localData = await local.json();
        if (local.ok && localData?.contact?.contact) {
          return localData;
        }
        if (localData?.error) {
          throw new Error(
            [String(localData.error), localData.hint].filter(Boolean).join(' — '),
          );
        }
      } catch (devErr) {
        if (devErr instanceof Error && !devErr.message.includes('Failed to fetch')) {
          throw devErr;
        }
        console.warn('[AC] Proxy local (.env) indisponível, usando Edge Function…', devErr);
      }
    }

    const { data, error } = await supabase.functions.invoke('sync-activecampaign', {
      body: { debug: 'contact', acId: id },
    });
    if (error) {
      const msg = await getFunctionInvokeErrorMessage(error, 'Falha ao chamar sync-activecampaign');
      if (msg.includes('não configurado') || msg.includes('non-2xx')) {
        throw new Error(
          'Credenciais do ActiveCampaign não estão no Supabase. No painel: Edge Functions → Secrets → ACTIVECAMPAIGN_URL e ACTIVECAMPAIGN_API_KEY (mesmos valores do .env). Ou rode npm run ac:secrets após supabase login.',
        );
      }
      throw new Error(msg);
    }
    if (data?.error) {
      const hint = data.hint ? String(data.hint) : '';
      throw new Error(
        [String(data.error), data.detail, hint].filter(Boolean).join(' — ') ||
          'Contato não encontrado no ActiveCampaign.',
      );
    }
    if (data?.contact?.error && !data?.contact?.contact) {
      throw new Error(
        `ActiveCampaign HTTP ${data.contactHttpStatus ?? '?'}: ${String(data.contact.error).slice(0, 200)}. Confira os Secrets no Supabase (URL *.api-us1.com + API key do .env).`,
      );
    }
    if (!data?.contact?.contact && !data?.fieldValues?.length) {
      throw new Error(
        'Resposta vazia do ActiveCampaign. Atualize a Edge Function sync-activecampaign no Supabase e configure os Secrets.',
      );
    }
    return data;
  };

  const buildPreviewFromAcData = (data: {
    contact?: AcImportRaw['contact'];
    fieldValues?: AcImportRaw['fieldValues'];
    contactData?: AcImportRaw['contactData'];
    tags?: string[];
    mapped?: Partial<Lead>;
  }): AcImportPreview => {
    const preview = mapAcImportToLead({
      contact: data.contact,
      fieldValues: data.fieldValues,
      contactData: data.contactData,
      tags: data.tags,
    });
    const serverMapped = data.mapped as Partial<Lead> | undefined;
    if (serverMapped) {
      const utmKeys = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_conjunto'] as const;
      for (const k of utmKeys) {
        if (serverMapped[k]) {
          preview.payload[k] = serverMapped[k];
          preview.marketing[k] = serverMapped[k];
        }
      }
      if (serverMapped.name) preview.payload.name = serverMapped.name;
      if (serverMapped.whatsapp) preview.payload.whatsapp = serverMapped.whatsapp;
      if (serverMapped.email) preview.payload.email = serverMapped.email;
      if (serverMapped.company) preview.payload.company = serverMapped.company;
      if (serverMapped.confection_type) preview.payload.confection_type = serverMapped.confection_type;
    }
    return preview;
  };

  const mergeAcPayloadIntoForm = useCallback((payload: Partial<Lead>): Partial<Lead> => {
    const prev = formDataRef.current;
    const merged: Partial<Lead> = {
      ...prev,
      ...payload,
      name: payload.name || prev.name,
      email: payload.email ?? prev.email,
      whatsapp: payload.whatsapp ?? prev.whatsapp,
      company: payload.company ?? prev.company,
      confection_type: payload.confection_type ?? prev.confection_type,
      website: payload.website ?? prev.website,
      pieces_per_month: payload.pieces_per_month ?? prev.pieces_per_month,
      meeting_pain: payload.meeting_pain ?? prev.meeting_pain,
      cpf_cnpj: payload.cpf_cnpj ?? prev.cpf_cnpj,
      utm_source: payload.utm_source ?? prev.utm_source,
      utm_campaign: payload.utm_campaign ?? prev.utm_campaign,
      utm_medium: payload.utm_medium ?? prev.utm_medium,
      utm_conjunto: payload.utm_conjunto ?? prev.utm_conjunto,
      activecampaign_id: payload.activecampaign_id ?? prev.activecampaign_id,
    };
    setFormData(merged);
    formDataRef.current = merged;
    return merged;
  }, []);

  const syncFromActiveCampaign = useCallback(
    async (
      acId: string,
      options?: { silent?: boolean; persist?: boolean; force?: boolean },
    ): Promise<boolean> => {
      if (!options?.force) {
        const current = formDataRef.current;
        if (!needsActiveCampaignMarketingFetch(current, acId)) {
          return true;
        }
      }

      setIsDebuggingAc(true);
      try {
        const data = await fetchAcContactData(acId);
        const preview = buildPreviewFromAcData(data);
        setAcDebugResult({ ...preview, raw: data });
        const merged = mergeAcPayloadIntoForm(preview.payload);

        const utmFilled = (['utm_source', 'utm_campaign', 'utm_medium', 'utm_conjunto'] as const).filter(
          (k) => preview.marketing[k],
        );

        if (options?.persist && lead?.id && utmFilled.length > 0) {
          const saved = await onSave(merged);
          if (!saved && !options.silent) {
            toast({
              title: 'Dados carregados',
              description: 'Não foi possível gravar automaticamente. Clique em Salvar.',
              variant: 'destructive',
            });
            return false;
          }
        }

        if (!options?.silent) {
          toast({
            title: utmFilled.length ? 'Marketing sincronizado' : 'Dados do ActiveCampaign',
            description: utmFilled.length
              ? `UTM: ${utmFilled.join(', ')}${options?.persist ? ' · gravado no CRM' : ' · clique em Salvar'}`
              : 'Contato encontrado; UTMs vazios no ActiveCampaign.',
          });
        }
        return true;
      } catch (err) {
        if (!options?.silent) {
          toast({
            title: 'Erro ao buscar ActiveCampaign',
            description: err instanceof Error ? err.message : 'Falha na consulta',
            variant: 'destructive',
          });
        }
        return false;
      } finally {
        setIsDebuggingAc(false);
      }
    },
    [lead?.id, mergeAcPayloadIntoForm, onSave, toast],
  );

  useEffect(() => {
    acAutoFetchKeyRef.current = null;
  }, [draftIdentity]);

  useEffect(() => {
    const acId = lead?.activecampaign_id
      ? String(lead.activecampaign_id)
      : parseActiveCampaignContactId(acLinkInput);
    if (!acId) return;

    const snapshot = lead ?? formDataRef.current;
    if (!needsActiveCampaignMarketingFetch(snapshot, acId)) {
      acAutoFetchKeyRef.current = `${draftIdentity}:${acId}:ok`;
      return;
    }

    const fetchKey = `${draftIdentity}:${acId}`;
    if (acAutoFetchKeyRef.current === fetchKey || acAutoFetchKeyRef.current === `${fetchKey}:ok`) {
      return;
    }

    const delayMs = lead?.activecampaign_id ? 400 : 900;
    const timer = window.setTimeout(() => {
      acAutoFetchKeyRef.current = fetchKey;
      void syncFromActiveCampaign(acId, {
        silent: true,
        persist: Boolean(lead?.id),
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    lead,
    lead?.id,
    lead?.activecampaign_id,
    lead?.utm_source,
    lead?.utm_campaign,
    lead?.utm_medium,
    lead?.utm_conjunto,
    acLinkInput,
    draftIdentity,
    syncFromActiveCampaign,
  ]);

  const handleFetchFromAc = async () => {
    const acId = resolveAcContactId();
    if (!acId) {
      toast({
        title: 'Link ou ID inválido',
        description: 'Cole o link do contato (ex: .../contacts/1236) ou o número do ID.',
        variant: 'destructive',
      });
      return;
    }
    acAutoFetchKeyRef.current = null;
    await syncFromActiveCampaign(acId, {
      silent: false,
      persist: Boolean(lead?.id),
      force: true,
    });
  };

  const handleDebugAc = async () => {
    if (!lead?.activecampaign_id && !acLinkInput.trim()) {
      await handleFetchFromAc();
      return;
    }
    const acId = resolveAcContactId();
    if (!acId) {
      toast({ title: 'Sem ID do ActiveCampaign', description: 'Informe o link ou vincule o lead ao AC.', variant: 'destructive' });
      return;
    }
    await handleFetchFromAc();
  };

  const applyAcDebugResult = () => {
    if (!acDebugResult) return;
    mergeAcPayloadIntoForm(acDebugResult.payload);
    toast({ title: 'Aplicado', description: 'Revise os campos e clique em Salvar para gravar no CRM.' });
  };

  const handleImportAndSaveAc = async () => {
    const acId = resolveAcContactId();
    if (!acId) {
      toast({
        title: 'Link ou ID inválido',
        description: 'Cole o link do ActiveCampaign (ex: .../contacts/1236).',
        variant: 'destructive',
      });
      return;
    }
    setIsImportingAc(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-activecampaign', {
        body: { action: 'importContact', acId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(String(data.error));

      if (data?.mapped) {
        const m = data.mapped as Partial<Lead>;
        setFormData((prev) => ({
          ...prev,
          ...m,
          name: m.name || prev.name,
          utm_source: m.utm_source ?? prev.utm_source,
          utm_campaign: m.utm_campaign ?? prev.utm_campaign,
          utm_medium: m.utm_medium ?? prev.utm_medium,
          utm_conjunto: m.utm_conjunto ?? prev.utm_conjunto,
        }));
      }

      toast({
        title: data?.action === 'created' ? 'Lead criado do ActiveCampaign' : 'Lead atualizado',
        description: `Contato AC #${acId} sincronizado no CRM.`,
      });

      if (data?.action === 'created' && data?.leadId) {
        onClose();
      }
    } catch (err) {
      toast({
        title: 'Erro ao importar',
        description: err instanceof Error ? err.message : 'Não foi possível salvar no CRM',
        variant: 'destructive',
      });
    } finally {
      setIsImportingAc(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = formData.name?.trim();
    if (!trimmedName) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, informe o nome do lead.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave: Partial<Lead> = {
        ...formData,
        name: trimmedName,
        // Ensure numeric fields are always numbers
        value: Number(formData.value) || 0,
        implementation_value: Number(formData.implementation_value) || 0,
        monthly_value: Number(formData.monthly_value) || 0,
      };

      const prevLinkSent = Boolean(lead?.new_system_link_sent);
      const newLinkSent = Boolean(dataToSave.new_system_link_sent);
      const linkChanged = lead && prevLinkSent !== newLinkSent;

      const success = await onSave(dataToSave);
      if (success) {
        // Clear drafts from localStorage on successful save
        if (draftKey) localStorage.removeItem(draftKey);
        if (noteDraftKey) localStorage.removeItem(noteDraftKey);
        if (tabKey) localStorage.removeItem(tabKey);

        // Registro automático no histórico quando o toggle de link do sistema novo muda
        if (linkChanged && lead) {
          const author = profile?.name || 'Usuário';
          const note = newLinkSent
            ? `🔗 Link do sistema novo marcado como ENVIADO por ${author}`
            : `🔗 Link do sistema novo desmarcado por ${author}`;
          await addHistory(lead.id, 'sistema_novo', note);
        }
      }
      // Em caso de falha, o hook (onSave) já exibe o toast com o motivo real — não mostrar "sem internet" aqui.
    } catch (err) {
      console.error('Error in handleSave:', err);
      toast({
        title: 'Erro inesperado',
        description: err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const suggestNextContact = () => {
    const nextDate = new Date();
    if (formData.stage === 'prospeccao') nextDate.setDate(nextDate.getDate() + 2);
    else if (formData.stage === 'interesse') nextDate.setDate(nextDate.getDate() + 3);
    else if (formData.stage === 'reuniao') nextDate.setDate(nextDate.getDate() + 1);
    else nextDate.setDate(nextDate.getDate() + 2);
    
    // Force time to be within commercial hours (08:30 to 17:50)
    // Pick a random time between 08:30 and 17:50
    const hours = [9, 10, 11, 14, 15, 16, 17];
    const minutes = [0, 30];
    const randomHour = hours[Math.floor(Math.random() * hours.length)];
    const randomMinute = minutes[Math.floor(Math.random() * minutes.length)];
    nextDate.setHours(randomHour, randomMinute, 0, 0);
    
    // Format as datetime-local value
    const pad = (n: number) => String(n).padStart(2, '0');
    const localStr = `${nextDate.getFullYear()}-${pad(nextDate.getMonth()+1)}-${pad(nextDate.getDate())}T${pad(nextDate.getHours())}:${pad(nextDate.getMinutes())}`;
    setFormData(prev => ({ ...prev, next_contact: localStr }));
  };

  const markAsLost = async (reason: string) => {
    setIsSaving(true);
    try {
      const success = await onSave({ ...formData, stage: 'perdidos', loss_reason: reason });
      if (success) setShowLossModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const markAsFrozen = async () => {
    if (!freezeReason.trim()) return;
    setIsSaving(true);
    try {
      const frozenNote = `🧊 Lead congelado. Motivo: ${freezeReason}${freezeDate ? `. Retomar em: ${freezeDate}` : ''}`;
      const newHistory: LeadHistory = { 
        type: 'sistema', 
        note: frozenNote,
        date: new Date().toISOString(), 
        user: profile?.name.split(' ')[0] || 'Sistema' 
      };
      const success = await onSave({ 
        ...formData, 
        stage: 'congelados', 
        loss_reason: freezeReason,
        next_contact: freezeDate || formData.next_contact,
        history: [newHistory, ...(formData.history || [])] 
      });
      if (success) {
        setShowFreezeModal(false);
        setFreezeReason('');
        setFreezeDate('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const reactivate = async () => {
    if (confirm("Reativar lead e mover para Prospecção?")) {
      const newHistory: LeadHistory = { type: 'sistema', note: '🔄 Lead Reativado', date: new Date().toISOString(), user: profile?.name.split(' ')[0] || 'Sistema' };
      setIsSaving(true);
      try {
        await onSave({ ...formData, stage: 'prospeccao', history: [newHistory, ...(formData.history || [])] });
      } finally {
        setIsSaving(false);
      }
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
      toast({
        title: 'WhatsApp não configurado',
        description: 'Adicione um número de WhatsApp primeiro.',
        variant: 'destructive',
      });
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
      // Get the user's auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        toast({
          title: 'Erro de autenticação',
          description: 'Faça login novamente para usar a IA.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'whatsapp', lead: formData }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || 'Erro ao gerar mensagem. Tente novamente.';
        toast({
          title: 'Erro na IA',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }
      
      const data = await response.json();
      if (data?.message) { 
        // Set the AI-generated message as the current text (don't overwrite saved template)
        setCurrentTemplate(data.message);
        toast({
          title: '✨ Mensagem gerada',
          description: 'Mensagem personalizada criada com IA. Edite se necessário e envie!',
        });
      } else {
        toast({
          title: 'Erro na geração',
          description: 'Não foi possível gerar a mensagem. Tente novamente.',
          variant: 'destructive',
        });
      }
    } catch (e) { 
      console.error('AI error:', e);
      toast({
        title: 'Falha na requisição',
        description:
          e instanceof TypeError && e.message === 'Failed to fetch'
            ? 'Não foi possível conectar ao servidor. Verifique sua internet ou tente mais tarde.'
            : e instanceof Error
              ? e.message
              : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveTemplate = () => {
    onUpdateTemplate(currentTemplate);
    toast({
      title: '✅ Template salvo',
      description: 'O modelo de mensagem foi atualizado para todos os leads.',
    });
  };

  const handleResetTemplate = () => {
    setCurrentTemplate(msgTemplate);
  };

  const handleGenerateObjectionResponses = async () => {
    if (!objectionText.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Descreva a objeção do cliente.', variant: 'destructive' });
      return;
    }
    setIsGeneratingObjection(true);
    setObjectionResponses([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({ title: 'Erro de autenticação', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'objection', lead: formData, objection: objectionText }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({ title: 'Erro na IA', description: errorData?.error || 'Tente novamente.', variant: 'destructive' });
        return;
      }
      const data = await response.json();
      if (data?.message) {
        // Parse the 3 responses separated by double newlines or numbered
        const responses = data.message
          .split(/\n\s*\n/)
          .map((r: string) => r.replace(/^\d+\.\s*/, '').trim())
          .filter((r: string) => r.length > 0);
        setObjectionResponses(responses.length > 0 ? responses.slice(0, 3) : [data.message]);
        toast({ title: '✨ Respostas geradas', description: '3 opções de resposta persuasiva prontas!' });
      }
    } catch (e) {
      console.error('Objection AI error:', e);
      toast({
        title: 'Falha na requisição',
        description:
          e instanceof TypeError && e.message === 'Failed to fetch'
            ? 'Não foi possível conectar ao servidor. Verifique sua internet ou tente mais tarde.'
            : e instanceof Error
              ? e.message
              : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingObjection(false);
    }
  };

  const sendObjectionWhatsApp = async (message: string) => {
    if (!formData.whatsapp) {
      toast({ title: 'WhatsApp não configurado', description: 'Adicione um número de WhatsApp primeiro.', variant: 'destructive' });
      return;
    }
    let finalMsg = message;
    if (profile?.signature) finalMsg += `\n\n${profile.signature}`;
    const phone = cleanPhoneNumber(formData.whatsapp);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(finalMsg)}`, '_blank');
    if (lead) {
      const updatedHistory = await addHistory(lead.id, 'whatsapp', `📱 Resposta a objeção enviada: "${finalMsg.substring(0, 100)}..."`);
      if (updatedHistory) {
        setFormData(prev => ({ ...prev, history: updatedHistory }));
      }
    }
  };

  const getActivityIcon = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.id === type);
    if (activity) return <activity.icon size={14} className={activity.color} />;
    if (type === 'stage_change') return <ChevronRight size={14} className="text-primary" />;
    if (type === 'criacao') return <Sparkles size={14} className="text-warning" />;
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
                  <Collapsible
                    className="md:col-span-2 space-y-2"
                    defaultOpen={
                      !!(
                        formData.utm_source ||
                        formData.utm_campaign ||
                        formData.utm_medium ||
                        formData.utm_conjunto ||
                        lead?.activecampaign_id
                      )
                    }
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/50 [&[data-state=open]>svg:last-child]:rotate-180">
                      <span className="flex items-center gap-2">
                        <Megaphone className="size-4 text-primary shrink-0" />
                        Marketing (UTM)
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/15 p-3">
                        <div>
                          <Label className="text-muted-foreground">utm-source</Label>
                          <Input name="utm_source" value={formData.utm_source || ''} onChange={handleChange} placeholder="Ex: ig" />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">utm_campaign</Label>
                          <Input name="utm_campaign" value={formData.utm_campaign || ''} onChange={handleChange} placeholder="Campanha" />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">utm_medium</Label>
                          <Input name="utm_medium" value={formData.utm_medium || ''} onChange={handleChange} placeholder="Meio" />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">utm_conjunto</Label>
                          <Input name="utm_conjunto" value={formData.utm_conjunto || ''} onChange={handleChange} placeholder="Conjunto" />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground px-0.5">
                        {isDebuggingAc
                          ? 'Sincronizando com o ActiveCampaign…'
                          : 'UTM vêm do sync/import do lead. Se faltar algum campo, buscamos no AC ao abrir (só uma vez).'}
                      </p>

                      <div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-background/60 p-3 text-xs">
                        <p className="font-medium text-foreground">Importar do ActiveCampaign</p>
                        <p className="text-muted-foreground">
                          Cole o link do contato (ex: .../contacts/1236 → ID 1236).
                        </p>
                        <Input
                          value={acLinkInput}
                          onChange={(e) => setAcLinkInput(e.target.value)}
                          placeholder="https://azouptecnologia.activehosted.com/app/contacts/1236"
                          className="text-xs h-9"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isDebuggingAc}
                            onClick={handleFetchFromAc}
                          >
                            {isDebuggingAc ? (
                              <>
                                <Loader2 className="size-3 mr-1 animate-spin" /> Buscando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="size-3 mr-1" /> Buscar e preencher
                              </>
                            )}
                          </Button>
                          <Button type="button" size="sm" disabled={isImportingAc} onClick={handleImportAndSaveAc}>
                            {isImportingAc ? (
                              <>
                                <Loader2 className="size-3 mr-1 animate-spin" /> Salvando...
                              </>
                            ) : (
                              'Importar e salvar no CRM'
                            )}
                          </Button>
                        </div>

                        {acDebugResult && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-1">
                              {(['utm_source', 'utm_campaign', 'utm_medium', 'utm_conjunto'] as const).map((k) => (
                                <div
                                  key={k}
                                  className="flex items-center justify-between rounded border border-border/40 bg-muted/30 px-2 py-1"
                                >
                                  <span className="font-mono text-[10px] text-muted-foreground">{k}</span>
                                  <span className="text-[11px] truncate ml-2">
                                    {String(acDebugResult.payload[k as keyof Lead] ?? '') || (
                                      <em className="text-muted-foreground">vazio</em>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {acDebugResult.unmappedFields.length > 0 && (
                              <details className="rounded border border-border/40 bg-muted/20 px-2 py-1">
                                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                                  Outros campos personalizados ({acDebugResult.unmappedFields.length}) — clique para ver
                                </summary>
                                <ul className="mt-1 space-y-0.5 text-[10px]">
                                  {acDebugResult.unmappedFields.map((f, i) => (
                                    <li key={i} className="font-mono">
                                      <span className="text-muted-foreground">[{f.perstag}]</span> {f.title}:{' '}
                                      <span className="text-foreground">{String(f.value)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}

                            <div className="flex justify-end">
                              <Button type="button" size="sm" onClick={applyAcDebugResult}>
                                Aplicar nos campos
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div>
                    <Label>Tipo Confecção</Label>
                    <Input name="confection_type" value={formData.confection_type || ''} onChange={handleChange} placeholder="Ex: Moda Fitness, Uniformes" />
                  </div>
                  <div className="bg-info/10 p-2 rounded border border-info/20">
                    <Label className="text-info">Próximo Contato (data e hora)</Label>
                    <div className="flex gap-2">
                      <Input type="datetime-local" name="next_contact" value={formData.next_contact || ''} onChange={handleChange} />
                      <Button variant="outline" size="sm" onClick={suggestNextContact} title="Sugerir horário comercial">✨</Button>
                    </div>
                    <p className="text-[10px] text-info/70 mt-1">✨ IA sugere horários dentro do horário comercial (08:30–17:50)</p>
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
                    <Label>Valor Implantação (R$)</Label>
                    <Input type="number" name="implementation_value" value={formData.implementation_value || 0} onChange={handleChange} min={0} />
                  </div>
                  <div>
                    <Label>Valor Mensalidade (R$)</Label>
                    <Input type="number" name="monthly_value" value={formData.monthly_value || 0} onChange={handleChange} min={0} />
                  </div>
                  <div>
                    <Label>Peças Produzidas/Mês</Label>
                    <Input 
                      type="number" 
                      name="pieces_per_month" 
                      value={formData.pieces_per_month ?? ''} 
                      onChange={handleChange} 
                      placeholder="Ex: 5000"
                      min={0} 
                    />
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
                  <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                    <Label className="mb-2 block font-semibold flex items-center gap-2">
                      🔗 Link do sistema novo enviado?
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={formData.new_system_link_sent ? 'default' : 'outline'}
                        className={formData.new_system_link_sent ? 'bg-[hsl(200_100%_50%)] hover:bg-[hsl(200_100%_45%)] text-white shadow-[0_0_12px_hsl(200_100%_50%/0.6)]' : ''}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          new_system_link_sent: true,
                          new_system_link_sent_at: prev.new_system_link_sent_at || new Date().toISOString(),
                        }))}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!formData.new_system_link_sent ? 'default' : 'outline'}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          new_system_link_sent: false,
                          new_system_link_sent_at: null,
                        }))}
                      >
                        Não
                      </Button>
                    </div>
                    {formData.new_system_link_sent && formData.new_system_link_sent_at && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Enviado em {new Date(formData.new_system_link_sent_at).toLocaleString('pt-BR')} · lembrete a cada 5 dias até marcar como Venda ou Perdido.
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                    <Label className="mb-2 block font-semibold flex items-center gap-2">
                      🎥 Lead Lançamento Live?
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={formData.is_live_launch ? 'default' : 'outline'}
                        className={formData.is_live_launch ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}
                        onClick={() => setFormData(prev => ({ ...prev, is_live_launch: true }))}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!formData.is_live_launch ? 'default' : 'outline'}
                        onClick={() => setFormData(prev => ({ ...prev, is_live_launch: false, live_launch_contacted: false }))}
                      >
                        Não
                      </Button>
                    </div>
                    {formData.is_live_launch && (
                      <div className="mt-3">
                        <Label className="mb-2 block text-xs">Lead já foi contatado?</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={formData.live_launch_contacted ? 'default' : 'outline'}
                            className={formData.live_launch_contacted ? 'bg-success hover:bg-success/90 text-white' : ''}
                            onClick={() => setFormData(prev => ({ ...prev, live_launch_contacted: true }))}
                          >
                            Sim (verde)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={!formData.live_launch_contacted ? 'default' : 'outline'}
                            className={!formData.live_launch_contacted ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}
                            onClick={() => setFormData(prev => ({ ...prev, live_launch_contacted: false }))}
                          >
                            Não (vermelho)
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Um ícone 🎥 aparecerá ao lado do nome no pipeline.
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Responsible Person Selector - visible to SDRs */}
                  {lead && (managerProfile || profile?.role === 'Gestor') && (
                    <div className="md:col-span-2 bg-muted/50 p-3 rounded-lg border border-border">
                      <Label className="mb-2 block flex items-center gap-2">
                        <UserCheck size={14} /> Responsável pelo Lead
                      </Label>
                      <Select
                        value={formData.responsible_user_id || formData.user_id || ''}
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, responsible_user_id: value }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {user && (
                            <SelectItem value={user.id}>
                              {profile?.name || 'Eu'} ({profile?.role || 'SDR'})
                            </SelectItem>
                          )}
                          {managerProfile && managerProfile.user_id !== user?.id && (
                            <SelectItem value={managerProfile.user_id}>
                              {managerProfile.name} (Gestor)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        As métricas do lead serão atribuídas ao responsável selecionado.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'actions' && lead && (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg border border-border flex justify-between items-center flex-wrap gap-2">
                  <div><span className="text-xs text-muted-foreground uppercase font-bold">Estágio:</span><p className="font-bold text-lg text-primary capitalize">{formData.stage}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {formData.stage === 'congelados' ? (
                      <Button onClick={reactivate} variant="outline"><RefreshCw size={16} className="mr-2" /> Reativar</Button>
                    ) : (
                      <>
                        {!['venda', 'perdidos'].includes(formData.stage || '') && (
                          <Button onClick={() => {
                            const next: Record<string, string> = { prospeccao: 'interesse', interesse: 'reuniao', reuniao: 'proposta', proposta: 'venda' };
                            if (next[formData.stage || '']) onSave({ ...formData, stage: next[formData.stage || ''] as any });
                          }}>Avançar <ChevronRight size={16} /></Button>
                        )}
                        {!['perdidos', 'venda', 'congelados'].includes(formData.stage || '') && (
                          <Button 
                            variant="outline" 
                            onClick={() => setShowFreezeModal(true)} 
                            className="text-info border-info/30"
                          >
                            🧊 Congelar
                          </Button>
                        )}
                        {!['perdidos', 'venda'].includes(formData.stage || '') && (
                          <Button variant="outline" onClick={() => setShowLossModal(true)} className="text-destructive border-destructive/30">Marcar Perdido</Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Meeting Status - Shown when lead is in 'reuniao' stage */}
                {formData.stage === 'reuniao' && (
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                    <Label className="mb-3 block font-bold flex items-center gap-2">
                      <Calendar size={16} className="text-primary" /> Status da Reunião
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant={formData.meeting_status === 'compareceu' ? 'default' : 'outline'}
                        className={formData.meeting_status === 'compareceu' ? 'bg-success hover:bg-success/90' : ''}
                        onClick={() => setFormData(prev => ({ ...prev, meeting_status: 'compareceu' }))}
                      >
                        ✅ Compareceu
                      </Button>
                      <Button
                        type="button"
                        variant={formData.meeting_status === 'no_show' ? 'default' : 'outline'}
                        className={formData.meeting_status === 'no_show' ? 'bg-destructive hover:bg-destructive/90' : ''}
                        onClick={() => setFormData(prev => ({ ...prev, meeting_status: 'no_show' }))}
                      >
                        ❌ No Show
                      </Button>
                      <Button
                        type="button"
                        variant={formData.meeting_status === 'reagendar' ? 'default' : 'outline'}
                        className={formData.meeting_status === 'reagendar' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}
                        onClick={() => setFormData(prev => ({ ...prev, meeting_status: 'reagendar' }))}
                      >
                        📅 Reagendar
                      </Button>
                    </div>
                    {formData.meeting_status && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Status atual: <span className="font-semibold capitalize">{formData.meeting_status === 'no_show' ? 'No Show' : formData.meeting_status === 'reagendar' ? 'Reagendar' : 'Compareceu'}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="border border-success/30 bg-success/5 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-success flex items-center gap-2"><MessageCircle size={18} /> WhatsApp Personalizado</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Use {'{nome}'}, {'{empresa}'}, {'{tipo}'} para personalização automática, ou gere com IA para uma mensagem única.
                  </p>
                  <Textarea 
                    className="mb-3" 
                    rows={4} 
                    value={currentTemplate} 
                    onChange={(e) => setCurrentTemplate(e.target.value)} 
                    placeholder="Olá {nome}, vi que você trabalha com {tipo}..."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={sendWhatsApp} className="bg-success hover:bg-success/90">
                      <MessageCircle size={14} className="mr-1" /> Enviar WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleGenerateMessage} disabled={isGenerating} className="text-primary border-primary/30">
                      {isGenerating ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sparkles size={14} className="mr-1" />} Gerar com IA
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSaveTemplate} className="text-muted-foreground">
                      <Save size={14} className="mr-1" /> Salvar Template
                    </Button>
                    {currentTemplate !== msgTemplate && (
                      <Button variant="ghost" size="sm" onClick={handleResetTemplate} className="text-muted-foreground">
                        <RefreshCw size={14} className="mr-1" /> Restaurar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Objection Handler - Only for Proposta stage */}
                {formData.stage === 'proposta' && (
                  <div className="border border-primary/30 bg-primary/5 p-4 rounded-lg">
                    <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
                      <Sparkles size={18} /> Contornar Objeções com IA
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Descreva a objeção ou desafio do cliente e a IA gerará 3 respostas persuasivas para enviar via WhatsApp.
                    </p>
                    <Textarea
                      rows={3}
                      value={objectionText}
                      onChange={(e) => setObjectionText(e.target.value)}
                      placeholder="Ex: O cliente disse que o preço está muito alto comparado ao concorrente..."
                      className="mb-3"
                    />
                    <Button
                      onClick={handleGenerateObjectionResponses}
                      disabled={isGeneratingObjection || !objectionText.trim()}
                      className="mb-3"
                    >
                      {isGeneratingObjection ? <Loader2 className="animate-spin mr-2" size={14} /> : <Sparkles size={14} className="mr-2" />}
                      Gerar 3 Respostas Persuasivas
                    </Button>

                    {objectionResponses.length > 0 && (
                      <div className="space-y-3 mt-2">
                        {objectionResponses.map((resp, idx) => (
                          <div key={idx} className="bg-card border border-border rounded-lg p-3">
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <span className="text-xs font-bold text-primary">Opção {idx + 1}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-success border-success/30 h-7 text-xs"
                                onClick={() => sendObjectionWhatsApp(resp)}
                              >
                                <MessageCircle size={12} className="mr-1" /> Enviar
                              </Button>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{resp}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2"><FileText size={18} /> Registrar Atividade</h3>
                  {/* Quick suggestion chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                      'Nova tentativa de contato',
                      'Fiz primeiro contato',
                      'Segunda tentativa de contato',
                      'Terceira tentativa de contato',
                      'Pediu para ligar semana que vem',
                      'Não atendeu',
                      'Deixou recado',
                      'Demonstrou interesse',
                      'Enviou proposta por WhatsApp',
                      'Agendou reunião',
                      'Pediu mais informações',
                      'Sem resposta',
                      'Cliente retornou contato',
                      'Enviou e-mail de follow-up',
                      'Reagendou reunião',
                      'Apresentação realizada',
                      'Aguardando retorno do cliente',
                      'Enviou material complementar',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setNoteText(suggestion)}
                        className="text-[11px] px-2 py-1 rounded-full border border-border bg-muted hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-primary transition"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
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

            {activeTab === 'meeting' && lead && (
              <div className="space-y-4">
                {/* Meeting Status Selector */}
                <div className="bg-muted p-4 rounded-lg border border-border">
                  <Label className="mb-3 block font-bold">Status da Reunião</Label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={formData.meeting_status === 'compareceu' ? 'default' : 'outline'}
                      className={formData.meeting_status === 'compareceu' ? 'bg-success hover:bg-success/90' : ''}
                      onClick={() => setFormData(prev => ({ ...prev, meeting_status: 'compareceu' }))}
                    >
                      ✅ Compareceu
                    </Button>
                    <Button
                      type="button"
                      variant={formData.meeting_status === 'no_show' ? 'default' : 'outline'}
                      className={formData.meeting_status === 'no_show' ? 'bg-destructive hover:bg-destructive/90' : ''}
                      onClick={() => setFormData(prev => ({ ...prev, meeting_status: 'no_show' }))}
                    >
                      ❌ No Show
                    </Button>
                    <Button
                      type="button"
                      variant={formData.meeting_status === 'reagendar' ? 'default' : 'outline'}
                      className={formData.meeting_status === 'reagendar' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}
                      onClick={() => setFormData(prev => ({ ...prev, meeting_status: 'reagendar' }))}
                    >
                      📅 Reagendar
                    </Button>
                  </div>
                  {formData.meeting_status && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Status atual: <span className="font-semibold capitalize">{formData.meeting_status === 'no_show' ? 'No Show' : formData.meeting_status === 'reagendar' ? 'Reagendar' : 'Compareceu'}</span>
                    </p>
                  )}
                </div>

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
                  <Input 
                    type="datetime-local" 
                    name="meeting_date" 
                    value={formData.meeting_date ? formData.meeting_date.slice(0, 16) : ''} 
                    onChange={(e) => {
                      const value = e.target.value;
                      // Store the datetime-local value directly (local time, not UTC)
                      // This preserves the exact time the user selected
                      setFormData(prev => ({ ...prev, meeting_date: value || null }));
                    }} 
                  />
                  {formData.meeting_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📅 Agendado: {formData.meeting_date.replace('T', ' às ').slice(0, 16).replace(/-/g, '/')}
                    </p>
                  )}
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
              {['Preço', 'Sem Interesse', 'Já possui sistema', 'Não Responde', 'Pequeno', 'Fechou com outra empresa', 'Deixou pro futuro', 'Outro'].map(reason => (
                <Button key={reason} variant="outline" onClick={() => markAsLost(reason)}>{reason}</Button>
              ))}
            </div>
            <button onClick={() => setShowLossModal(false)} className="mt-6 text-muted-foreground hover:text-foreground underline">Cancelar</button>
          </div>
        )}

        {showFreezeModal && (
          <div className="absolute inset-0 bg-card/95 z-50 flex flex-col items-center justify-center p-8">
            <h3 className="text-xl font-bold text-foreground mb-2">🧊 Congelar Lead</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">Informe o motivo e a data prevista para retomar o contato</p>
            <div className="w-full max-w-sm space-y-4">
              <div>
                <Label>Motivo do congelamento *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 mb-2">
                  {['Sem verba agora', 'Decisão adiada', 'Férias / Afastamento', 'Aguardando sócio', 'Sem interesse no momento', 'Outro'].map(r => (
                    <Button 
                      key={r} 
                      variant={freezeReason === r ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setFreezeReason(r)}
                      className="text-xs"
                    >
                      {r}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Ou descreva outro motivo..."
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                />
              </div>
              <div>
                <Label>Data para retomar contato</Label>
                <Input 
                  type="date" 
                  value={freezeDate} 
                  onChange={(e) => setFreezeDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-3">
                <Button 
                  className="flex-1" 
                  onClick={markAsFrozen} 
                  disabled={!freezeReason.trim() || isSaving}
                >
                  {isSaving ? <Loader2 size={14} className="mr-2 animate-spin" /> : '🧊 '}
                  Congelar Lead
                </Button>
              </div>
            </div>
            <button onClick={() => { setShowFreezeModal(false); setFreezeReason(''); setFreezeDate(''); }} className="mt-4 text-muted-foreground hover:text-foreground underline">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}
