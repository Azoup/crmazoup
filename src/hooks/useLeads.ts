import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, LeadHistory, LeadFilters, UserSettings } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';
import { useNewLeadSound } from '@/hooks/useNewLeadSound';
import { runWithSchemaFallback } from '@/lib/supabaseRetry';

function parseHistory(historyJson: Json): LeadHistory[] {
  if (!historyJson) return [];
  if (Array.isArray(historyJson)) {
    return historyJson
      .filter((item: any) => item && typeof item === 'object')
      .map((item: any) => ({
        type: item.type || '',
        note: item.note || '',
        date: item.date || '',
        user: item.user || '',
      }));
  }
  return [];
}

function transformDbLead(dbLead: any): Lead {
  // Validate temperature - use 'frio' as safe default for new leads
  const validTemperatures = ['frio', 'morno', 'quente'];
  const safeTemperature = validTemperatures.includes(dbLead.temperature) 
    ? dbLead.temperature 
    : 'frio';
  
  // Validate stage - use 'prospeccao' as safe default
  const validStages = ['prospeccao', 'interesse', 'reuniao', 'proposta', 'venda', 'congelados', 'perdidos'];
  const safeStage = validStages.includes(dbLead.stage) 
    ? dbLead.stage 
    : 'prospeccao';

  return {
    id: dbLead.id || '',
    user_id: dbLead.user_id || '',
    name: dbLead.name || 'Sem nome',
    company: dbLead.company ?? null,
    confection_type: dbLead.confection_type ?? null,
    whatsapp: dbLead.whatsapp ?? null,
    email: dbLead.email ?? null,
    website: dbLead.website ?? null,
    temperature: safeTemperature,
    value: Number(dbLead.value) || 0,
    implementation_value: Number(dbLead.implementation_value) || 0,
    monthly_value: Number(dbLead.monthly_value) || 0,
    stage: safeStage,
    loss_reason: dbLead.loss_reason ?? null,
    next_contact: dbLead.next_contact ?? null,
    last_contact: dbLead.last_contact ?? null,
    entry_date: dbLead.entry_date ?? null,
    meeting_pain: dbLead.meeting_pain ?? null,
    meeting_needs: dbLead.meeting_needs ?? null,
    meeting_link: dbLead.meeting_link ?? null,
    meeting_date: dbLead.meeting_date ?? null,
    history: parseHistory(dbLead.history),
    created_at: dbLead.created_at || new Date().toISOString(),
    updated_at: dbLead.updated_at || new Date().toISOString(),
    // Extended fields with safe defaults
    is_new: dbLead.is_new ?? false,
    manager_notes: dbLead.manager_notes ?? null,
    activecampaign_id: dbLead.activecampaign_id ?? null,
    meeting_status: dbLead.meeting_status ?? null,
    reference_month: dbLead.reference_month ?? null,
    pieces_per_month: dbLead.pieces_per_month != null ? Number(dbLead.pieces_per_month) : null,
    responsible_user_id: dbLead.responsible_user_id ?? null,
    lead_source: dbLead.lead_source ?? 'marketing',
      cpf: dbLead.cpf ?? null,
      cpf_cnpj: dbLead.cpf_cnpj ?? null,
      state_registration: dbLead.state_registration ?? null,
      implementation_responsible: dbLead.implementation_responsible ?? null,
      implementation_responsible_phone: (dbLead as any).implementation_responsible_phone ?? null,
      signer_name: dbLead.signer_name ?? null,
      signer_phone: (dbLead as any).signer_phone ?? null,
      signer_email: (dbLead as any).signer_email ?? null,
      signer_role: dbLead.signer_role ?? null,
      birthdate: dbLead.birthdate ?? null,
      address: dbLead.address ?? null,
      client_observations: dbLead.client_observations ?? null,
    utm_source: dbLead.utm_source ?? null,
    utm_campaign: dbLead.utm_campaign ?? null,
    utm_medium: dbLead.utm_medium ?? null,
    utm_conjunto: dbLead.utm_conjunto ?? null,
  };
}

export function useLeads() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { playNewLeadSound } = useNewLeadSound();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState<LeadFilters>({
    search: '',
    temperature: 'todos',
    confectionType: '',
  });

  const isManager = profile?.role === 'Gestor';

  useEffect(() => {
    if (!user) {
      setLeads([]);
      setSettings(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      // Fetch leads according to RLS visibility (own, responsible, equipe/gestão)
      // Fetch all leads (raise limit to avoid missing leads from prospeccao_ativa/indicacao)
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
        toast({ title: 'Erro', description: 'Erro ao carregar leads', variant: 'destructive' });
      } else {
        setLeads((leadsData || []).map(transformDbLead));
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching settings:', settingsError);
      } else if (settingsData) {
        setSettings({
          id: settingsData.id,
          user_id: settingsData.user_id,
          sales_goal: Number(settingsData.sales_goal),
          msg_template: settingsData.msg_template,
          meeting_goal: (settingsData as any).meeting_goal ?? 0,
        });
      }

      setLoading(false);
    };

    fetchData();
  }, [user, isManager]);

  // Realtime subscription (RLS já entrega apenas os registros visíveis para o usuário)
  useEffect(() => {
    if (!user) return;

    console.log('[Realtime] Setting up subscription', { userId: user.id, isManager });

    const channelName = `leads-realtime-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        const newLead = payload.new as any;
        const oldLead = payload.old as any;

        console.log('[Realtime] Received event:', payload.eventType, { id: newLead?.id || oldLead?.id });

        if (payload.eventType === 'INSERT' && newLead?.id) {
          setLeads(prev => {
            const transformedLead = transformDbLead(newLead);
            if (prev.some(l => l.id === transformedLead.id)) return prev;
            // Play notification sound for new leads
            if (transformedLead.is_new) {
              playNewLeadSound();
              toast({
                title: '🎉 Novo Lead!',
                description: `${transformedLead.name} acabou de chegar!`,
              });
            }
            return [transformedLead, ...prev];
          });
          return;
        }

        if (payload.eventType === 'UPDATE' && newLead?.id) {
          setLeads(prev => {
            const transformedLead = transformDbLead(newLead);
            const exists = prev.some(l => l.id === transformedLead.id);
            if (!exists) return [transformedLead, ...prev];
            return prev.map(l => l.id === transformedLead.id ? transformedLead : l);
          });
          return;
        }

        if (payload.eventType === 'DELETE' && oldLead?.id) {
          setLeads(prev => prev.filter(l => l.id !== oldLead.id));
        }
      })
      .subscribe((status, err) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error - will retry on next interaction:', err);
        }
      });

    return () => {
      console.log('[Realtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, isManager]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const s = filters.search.toLowerCase();
      const matchSearch = !s ||
        lead.name?.toLowerCase().includes(s) ||
        lead.company?.toLowerCase()?.includes(s) ||
        lead.whatsapp?.toLowerCase()?.includes(s) ||
        false;
      const matchTemp = filters.temperature === 'todos' || lead.temperature === filters.temperature;
      const matchType = !filters.confectionType || 
        lead.confection_type?.toLowerCase()?.includes(filters.confectionType.toLowerCase()) ||
        false;
      return matchSearch && matchTemp && matchType;
    });
  }, [leads, filters]);

  const addLead = async (leadData: Partial<Lead>): Promise<Lead | null> => {
    if (!user || !profile) {
      toast({ title: 'Erro', description: 'Você precisa estar logado para criar leads', variant: 'destructive' });
      return null;
    }

    const trimmedName = leadData.name?.trim();
    if (!trimmedName) {
      toast({ title: 'Erro', description: 'O nome do lead é obrigatório', variant: 'destructive' });
      return null;
    }

    const history: LeadHistory[] = [{
      type: 'criacao',
      note: `Lead "${trimmedName}" criado por ${profile.name ?? 'Sistema'}`,
      date: new Date().toISOString(),
      user: profile.name?.split(' ')[0] ?? 'Sistema',
    }];

    try {
      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        name: trimmedName,
        company: leadData.company?.trim() || null,
        confection_type: leadData.confection_type?.trim() || null,
        whatsapp: leadData.whatsapp?.trim() || null,
        email: leadData.email?.trim() || null,
        website: leadData.website?.trim() || null,
        temperature: leadData.temperature || 'frio',
        value: Number(leadData.value) || 0,
        implementation_value: Number(leadData.implementation_value) || 0,
        monthly_value: Number(leadData.monthly_value) || 0,
        stage: leadData.stage || 'prospeccao',
        lead_source: leadData.lead_source || 'marketing',
        next_contact: leadData.next_contact || null,
        meeting_pain: leadData.meeting_pain?.trim() || null,
        meeting_needs: leadData.meeting_needs?.trim() || null,
        meeting_link: leadData.meeting_link?.trim() || null,
        meeting_date: leadData.meeting_date || null,
        history: history as unknown as Json,
        last_contact: new Date().toISOString(),
        entry_date: new Date().toISOString(),
        pieces_per_month: leadData.pieces_per_month != null ? Number(leadData.pieces_per_month) : null,
        utm_source: leadData.utm_source?.trim() || null,
        utm_campaign: leadData.utm_campaign?.trim() || null,
        utm_medium: leadData.utm_medium?.trim() || null,
        utm_conjunto: leadData.utm_conjunto?.trim() || null,
      };

      const { data, error, skippedColumns } = await runWithSchemaFallback(
        insertPayload,
        async (payload) => {
          const result = await supabase
            .from('leads')
            .insert(payload as never)
            .select()
            .single();
          return { data: result.data, error: result.error };
        },
      );

      if (error) {
        console.error('Error adding lead:', error);
        toast({ title: 'Erro', description: `Erro ao criar lead: ${error.message}`, variant: 'destructive' });
        return null;
      }

      if (!data) {
        toast({ title: 'Erro', description: 'Não foi possível criar o lead', variant: 'destructive' });
        return null;
      }

      const createdLead = transformDbLead(data);
      setLeads(prev => (prev.some(l => l.id === createdLead.id) ? prev : [createdLead, ...prev]));

      if (skippedColumns.length > 0) {
        toast({
          title: 'Lead criado (com ressalva)',
          description: `Estes campos foram ignorados porque ainda não existem no banco: ${skippedColumns.join(', ')}. Aplique a migração no Supabase.`,
        });
      } else {
        toast({ title: 'Sucesso', description: 'Lead criado com sucesso!' });
      }
      return createdLead;
    } catch (err) {
      console.error('Unexpected error adding lead:', err);
      toast({ title: 'Erro', description: 'Erro inesperado ao criar lead', variant: 'destructive' });
      return null;
    }
  };

  const updateLead = async (leadId: string, updates: Partial<Lead>): Promise<boolean> => {
    if (!user || !profile) {
      toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
      return false;
    }

    if (!leadId) {
      toast({ title: 'Erro', description: 'ID do lead inválido', variant: 'destructive' });
      return false;
    }

    const currentLead = leads.find(l => l.id === leadId);
    if (!currentLead) {
      toast({ title: 'Erro', description: 'Lead não encontrado', variant: 'destructive' });
      return false;
    }

    try {
      // Safely get current history, ensuring it's always an array
      const currentHistory = Array.isArray(currentLead.history) ? currentLead.history : [];
      const updatesHistory = Array.isArray(updates.history) ? updates.history : null;
      
      let newHistory = [...(updatesHistory ?? currentHistory)];
      
      // Only add stage change history if stage is explicitly provided and different
      if (updates.stage !== undefined && updates.stage !== currentLead.stage) {
        newHistory = [{
          type: 'stage_change',
          note: `Fase: ${currentLead.stage?.toUpperCase() ?? 'N/A'} → ${updates.stage?.toUpperCase() ?? 'N/A'}`,
          date: new Date().toISOString(),
          user: profile.name?.split(' ')[0] ?? 'Sistema',
        }, ...newHistory];
      }

      // Build a MINIMAL update payload — only send fields that are explicitly provided
      // This prevents race conditions where concurrent updates overwrite each other
      const updatePayload: Record<string, any> = {
        is_new: false,
        last_contact: updates.last_contact || new Date().toISOString(),
        history: newHistory as unknown as Json,
      };

      // Only include fields that were explicitly passed in updates
      if (updates.name !== undefined) updatePayload.name = updates.name || 'Sem nome';
      if (updates.company !== undefined) updatePayload.company = updates.company ?? null;
      if (updates.confection_type !== undefined) updatePayload.confection_type = updates.confection_type ?? null;
      if (updates.whatsapp !== undefined) updatePayload.whatsapp = updates.whatsapp ?? null;
      if (updates.email !== undefined) updatePayload.email = updates.email ?? null;
      if (updates.website !== undefined) updatePayload.website = updates.website ?? null;
      if (updates.temperature !== undefined) updatePayload.temperature = updates.temperature;
      if (updates.value !== undefined) updatePayload.value = updates.value ?? 0;
      if (updates.implementation_value !== undefined) updatePayload.implementation_value = updates.implementation_value ?? 0;
      if (updates.monthly_value !== undefined) updatePayload.monthly_value = updates.monthly_value ?? 0;
      if (updates.stage !== undefined) updatePayload.stage = updates.stage;
      if (updates.loss_reason !== undefined) updatePayload.loss_reason = updates.loss_reason ?? null;
      if (updates.next_contact !== undefined) updatePayload.next_contact = updates.next_contact ?? null;
      if (updates.meeting_pain !== undefined) updatePayload.meeting_pain = updates.meeting_pain ?? null;
      if (updates.meeting_needs !== undefined) updatePayload.meeting_needs = updates.meeting_needs ?? null;
      if (updates.meeting_link !== undefined) updatePayload.meeting_link = updates.meeting_link ?? null;
      if (updates.meeting_date !== undefined) updatePayload.meeting_date = updates.meeting_date ?? null;
      if (updates.meeting_status !== undefined) updatePayload.meeting_status = updates.meeting_status ?? null;
      if (updates.pieces_per_month !== undefined) updatePayload.pieces_per_month = updates.pieces_per_month ?? null;
      if (updates.responsible_user_id !== undefined) updatePayload.responsible_user_id = updates.responsible_user_id ?? null;
      // Client file (Ficha do Cliente) fields
      if ((updates as any).cpf !== undefined) updatePayload.cpf = (updates as any).cpf ?? null;
      if (updates.cpf_cnpj !== undefined) updatePayload.cpf_cnpj = updates.cpf_cnpj ?? null;
      if (updates.state_registration !== undefined) updatePayload.state_registration = updates.state_registration ?? null;
      if (updates.implementation_responsible !== undefined) updatePayload.implementation_responsible = updates.implementation_responsible ?? null;
      if ((updates as any).implementation_responsible_phone !== undefined) updatePayload.implementation_responsible_phone = (updates as any).implementation_responsible_phone ?? null;
      if (updates.signer_name !== undefined) updatePayload.signer_name = updates.signer_name ?? null;
      if ((updates as any).signer_phone !== undefined) updatePayload.signer_phone = (updates as any).signer_phone ?? null;
      if ((updates as any).signer_email !== undefined) updatePayload.signer_email = (updates as any).signer_email ?? null;
      if (updates.signer_role !== undefined) updatePayload.signer_role = updates.signer_role ?? null;
      if (updates.birthdate !== undefined) updatePayload.birthdate = updates.birthdate ?? null;
      if (updates.address !== undefined) updatePayload.address = updates.address ?? null;
      if (updates.client_observations !== undefined) updatePayload.client_observations = updates.client_observations ?? null;
      if (updates.manager_notes !== undefined) updatePayload.manager_notes = updates.manager_notes ?? null;
      if (updates.utm_source !== undefined) {
        updatePayload.utm_source =
          typeof updates.utm_source === 'string' && updates.utm_source.trim() === ''
            ? null
            : (updates.utm_source ?? null);
      }
      if (updates.utm_campaign !== undefined) {
        updatePayload.utm_campaign =
          typeof updates.utm_campaign === 'string' && updates.utm_campaign.trim() === ''
            ? null
            : (updates.utm_campaign ?? null);
      }
      if (updates.utm_medium !== undefined) {
        updatePayload.utm_medium =
          typeof updates.utm_medium === 'string' && updates.utm_medium.trim() === ''
            ? null
            : (updates.utm_medium ?? null);
      }
      if (updates.utm_conjunto !== undefined) {
        updatePayload.utm_conjunto =
          typeof updates.utm_conjunto === 'string' && updates.utm_conjunto.trim() === ''
            ? null
            : (updates.utm_conjunto ?? null);
      }

      const { error, skippedColumns } = await runWithSchemaFallback(
        updatePayload,
        async (payload) => {
          const result = await supabase
            .from('leads')
            .update(payload as never)
            .eq('id', leadId);
          return { data: null, error: result.error };
        },
      );

      if (error) {
        console.error('Error updating lead:', error);
        toast({
          title: 'Erro',
          description: `Erro ao atualizar lead: ${error.message}`,
          variant: 'destructive',
        });
        return false;
      }

      // Update local state optimistically
      const appliedPayload = { ...updatePayload };
      for (const col of skippedColumns) delete appliedPayload[col];
      setLeads(prev => prev.map(l =>
        l.id === leadId
          ? { ...l, ...appliedPayload, history: newHistory }
          : l
      ));

      if (skippedColumns.length > 0) {
        toast({
          title: 'Lead salvo (com ressalva)',
          description: `Estes campos não existem no banco e foram ignorados: ${skippedColumns.join(', ')}. Aplique a migração no Supabase para passá-los.`,
        });
      } else {
        toast({ title: 'Sucesso', description: 'Lead atualizado!' });
      }
      return true;
    } catch (err) {
      console.error('Unexpected error updating lead:', err);
      toast({ title: 'Erro', description: 'Erro inesperado ao atualizar lead', variant: 'destructive' });
      return false;
    }
  };

  const deleteLead = async (leadId: string) => {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      console.error('Error deleting lead:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir lead', variant: 'destructive' });
      return;
    }

    toast({ title: 'Sucesso', description: 'Lead excluído!' });
  };

  const addHistory = async (leadId: string, type: string, note: string): Promise<LeadHistory[] | null> => {
    if (!user || !profile) {
      toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
      return null;
    }

    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      toast({ title: 'Erro', description: 'Lead não encontrado', variant: 'destructive' });
      return null;
    }

    const newEntry: LeadHistory = {
      type,
      note,
      date: new Date().toISOString(),
      user: profile.name.split(' ')[0],
    };

    const newHistory = [newEntry, ...lead.history];

    const { error } = await supabase
      .from('leads')
      .update({
        history: newHistory as unknown as Json,
        last_contact: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (error) {
      console.error('Error adding history:', error);
      toast({ title: 'Erro', description: 'Erro ao registrar atividade', variant: 'destructive' });
      return null;
    }

    // Update local state immediately
    setLeads(prev => prev.map(l => 
      l.id === leadId 
        ? { ...l, history: newHistory, last_contact: new Date().toISOString() }
        : l
    ));

    toast({ title: 'Sucesso', description: 'Atividade registrada no histórico!' });
    return newHistory;
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return;

    // Check if settings exist, if not create them
    if (!settings) {
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          sales_goal: updates.sales_goal || 50000,
          msg_template: updates.msg_template || 'Olá {nome}! Vi que você trabalha com {tipo}. Podemos conversar?',
        });

      if (insertError) {
        console.error('Error creating settings:', insertError);
        toast({ title: 'Erro', description: 'Erro ao criar configurações', variant: 'destructive' });
        return;
      }

      setSettings({
        id: '',
        user_id: user.id,
        sales_goal: updates.sales_goal || 50000,
        msg_template: updates.msg_template || 'Olá {nome}! Vi que você trabalha com {tipo}. Podemos conversar?',
      });
      toast({ title: 'Sucesso', description: 'Configurações salvas!' });
      return;
    }

    const updatePayload: any = {};
    if (updates.sales_goal !== undefined) updatePayload.sales_goal = updates.sales_goal;
    if (updates.msg_template !== undefined) updatePayload.msg_template = updates.msg_template;
    if (updates.meeting_goal !== undefined) updatePayload.meeting_goal = updates.meeting_goal;

    const { error } = await supabase
      .from('user_settings')
      .update(updatePayload)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating settings:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar configurações', variant: 'destructive' });
      return;
    }

    setSettings(prev => prev ? { ...prev, ...updates } : null);
    toast({ title: 'Sucesso', description: 'Configurações atualizadas!' });
  };

  const getLeadStatus = (lead: Lead): 'late' | 'today' | 'ontime' | 'neutral' => {
    if (['venda', 'perdidos', 'congelados'].includes(lead.stage)) return 'neutral';
    
    if (lead.next_contact) {
      const nextDate = new Date(lead.next_contact);
      nextDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (nextDate < today) return 'late';
      if (nextDate.getTime() === today.getTime()) return 'today';
      return 'ontime';
    }

    if (lead.last_contact) {
      const lastContactDate = new Date(lead.last_contact);
      const daysSince = Math.ceil(Math.abs(new Date().getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince > 3 ? 'late' : 'ontime';
    }

    return 'ontime';
  };

  const totalSold = useMemo(() => {
    return leads
      .filter(l => l.stage === 'venda')
      .reduce((acc, curr) => acc + (curr.implementation_value || 0) + (curr.monthly_value || 0), 0);
  }, [leads]);

  const totalImplementation = useMemo(() => {
    return leads
      .filter(l => l.stage === 'venda')
      .reduce((acc, curr) => acc + (curr.implementation_value || 0), 0);
  }, [leads]);

  const totalMonthly = useMemo(() => {
    return leads
      .filter(l => l.stage === 'venda')
      .reduce((acc, curr) => acc + (curr.monthly_value || 0), 0);
  }, [leads]);

  const percentGoal = useMemo(() => {
    if (!settings?.sales_goal) return 0;
    // Meta de vendas é calculada apenas com valor de implantação
    return Math.min(100, (totalImplementation / settings.sales_goal) * 100);
  }, [totalImplementation, settings?.sales_goal]);

  const debugActiveCampaign = async (
    mode: 'fields' | 'contact' | 'lead',
    params: { acId?: string; leadId?: string } = {},
  ): Promise<{ data?: any; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-activecampaign', {
        body: { debug: mode, acId: params.acId, leadId: params.leadId },
      });
      if (error) return { error: error.message || 'Erro ao chamar debug' };
      return { data };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Erro inesperado' };
    }
  };

  const syncActiveCampaign = async (options?: { silent?: boolean }): Promise<{ imported: number; error?: string }> => {
    if (!user) {
      return { imported: 0, error: 'Você precisa estar logado' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-activecampaign');

      if (error) {
        console.error('Error syncing ActiveCampaign:', error);
        if (!options?.silent) {
          toast({ 
            title: 'Erro', 
            description: 'Erro ao sincronizar com ActiveCampaign', 
            variant: 'destructive' 
          });
        }
        return { imported: 0, error: error.message };
      }

      if (data.success) {
        if (!options?.silent) {
          const diag = data.utm_diagnostics as
            | { contacts_with_any_utm?: number; mapped_fields?: Record<string, unknown> }
            | undefined;
          const mappedCount = diag?.mapped_fields ? Object.keys(diag.mapped_fields).length : 0;
          const withUtm = diag?.contacts_with_any_utm ?? 0;
          const utmUpdates = data.utm_updates ?? 0;
          const extra = ` · UTM: ${mappedCount} campo(s) mapeado(s), ${withUtm} contato(s) com dado, ${utmUpdates} atualização(ões)`;
          toast({
            title: 'Sincronização Concluída',
            description: `${data.imported} leads importados do ActiveCampaign${extra}`,
          });
          if (mappedCount === 0) {
            toast({
              title: 'Atenção: nenhum campo UTM mapeado',
              description:
                'O ActiveCampaign não retornou nenhum campo personalizado com nome utm_source / utm_campaign / utm_medium / utm_conjunto. Verifique os nomes/perstags no AC.',
              variant: 'destructive',
            });
          }
        }
        return { imported: data.imported };
      } else {
        if (!options?.silent) {
          toast({ title: 'Erro', description: data.error, variant: 'destructive' });
        }
        return { imported: 0, error: data.error };
      }
    } catch (err) {
      console.error('Unexpected error syncing:', err);
      if (!options?.silent) {
        toast({ 
          title: 'Erro', 
          description: 'Erro inesperado ao sincronizar', 
          variant: 'destructive' 
        });
      }
      return { imported: 0, error: 'Erro inesperado' };
    }
  };

  useEffect(() => {
    if (!user || isManager) return;

    let isRunning = false;

    const runAutoSync = async () => {
      if (isRunning) return;
      isRunning = true;
      await syncActiveCampaign({ silent: true });
      isRunning = false;
    };

    // Sync inicial ao abrir o CRM
    runAutoSync();

    // Sync automático a cada 5 minutos
    const intervalId = window.setInterval(runAutoSync, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user?.id, isManager]);

  return {
    leads,
    filteredLeads,
    settings,
    loading,
    filters,
    setFilters,
    addLead,
    updateLead,
    deleteLead,
    addHistory,
    updateSettings,
    getLeadStatus,
    totalSold,
    totalImplementation,
    totalMonthly,
    percentGoal,
    syncActiveCampaign,
    debugActiveCampaign,
  };
}