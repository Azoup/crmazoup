import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, LeadHistory, LeadFilters, UserSettings } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

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
  return {
    id: dbLead.id,
    user_id: dbLead.user_id,
    name: dbLead.name,
    company: dbLead.company,
    confection_type: dbLead.confection_type,
    whatsapp: dbLead.whatsapp,
    email: dbLead.email,
    website: dbLead.website,
    temperature: dbLead.temperature,
    value: Number(dbLead.value) || 0,
    implementation_value: Number(dbLead.implementation_value) || 0,
    monthly_value: Number(dbLead.monthly_value) || 0,
    stage: dbLead.stage,
    loss_reason: dbLead.loss_reason,
    next_contact: dbLead.next_contact,
    last_contact: dbLead.last_contact,
    entry_date: dbLead.entry_date,
    meeting_pain: dbLead.meeting_pain,
    meeting_needs: dbLead.meeting_needs,
    meeting_link: dbLead.meeting_link,
    meeting_date: dbLead.meeting_date,
    history: parseHistory(dbLead.history),
    created_at: dbLead.created_at,
    updated_at: dbLead.updated_at,
    // New fields
    is_new: dbLead.is_new ?? false,
    manager_notes: dbLead.manager_notes ?? null,
    activecampaign_id: dbLead.activecampaign_id ?? null,
    meeting_status: dbLead.meeting_status ?? null,
    reference_month: dbLead.reference_month ?? null,
  };
}

export function useLeads() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sdrIds, setSdrIds] = useState<string[]>([]);
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
      
      // For managers, first get the SDR IDs they manage
      let managedSdrIds: string[] = [];
      if (isManager) {
        const { data: relations } = await supabase
          .from('manager_sdr_relations')
          .select('sdr_id')
          .eq('manager_id', user.id);
        
        managedSdrIds = relations?.map(r => r.sdr_id) || [];
        setSdrIds(managedSdrIds);
      }

      // Fetch leads - managers see their SDRs' leads, SDRs see their own
      let leadsQuery = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (isManager && managedSdrIds.length > 0) {
        // Manager sees all leads from their SDRs
        leadsQuery = leadsQuery.in('user_id', managedSdrIds);
      } else if (!isManager) {
        // SDR sees only their own leads
        leadsQuery = leadsQuery.eq('user_id', user.id);
      }

      const { data: leadsData, error: leadsError } = await leadsQuery;

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
        });
      }

      setLoading(false);
    };

    fetchData();
  }, [user, isManager]);

  // Separate effect for realtime subscription
  // Wait for sdrIds to be loaded for managers before subscribing
  useEffect(() => {
    if (!user) return;
    
    // For managers, wait until sdrIds are loaded
    if (isManager && sdrIds.length === 0 && !loading) {
      console.log('[Realtime] Manager has no SDRs linked yet');
      return;
    }

    console.log('[Realtime] Setting up subscription', { 
      isManager, 
      userId: user.id, 
      sdrIds: sdrIds.length > 0 ? sdrIds : 'N/A' 
    });

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
        const leadUserId = newLead?.user_id || oldLead?.user_id;

        console.log('[Realtime] Received event:', payload.eventType, { leadUserId });

        // Filter: managers see SDR leads, SDRs see only their own
        let isRelevant = false;
        if (isManager) {
          isRelevant = sdrIds.includes(leadUserId);
        } else {
          isRelevant = leadUserId === user.id;
        }

        console.log('[Realtime] Is relevant?', isRelevant, { isManager, sdrIds, leadUserId });

        if (!isRelevant) return;

        if (payload.eventType === 'INSERT') {
          console.log('[Realtime] Adding new lead');
          setLeads(prev => {
            // Avoid duplicates
            if (prev.some(l => l.id === newLead.id)) return prev;
            return [transformDbLead(newLead), ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          console.log('[Realtime] Updating lead');
          setLeads(prev => prev.map(l => l.id === newLead.id ? transformDbLead(newLead) : l));
        } else if (payload.eventType === 'DELETE') {
          console.log('[Realtime] Deleting lead');
          setLeads(prev => prev.filter(l => l.id !== oldLead.id));
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user, isManager, sdrIds, loading]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchSearch = 
        lead.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        lead.company?.toLowerCase().includes(filters.search.toLowerCase());
      const matchTemp = filters.temperature === 'todos' || lead.temperature === filters.temperature;
      const matchType = !filters.confectionType || 
        lead.confection_type?.toLowerCase().includes(filters.confectionType.toLowerCase());
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
      const { data, error } = await supabase
        .from('leads')
        .insert({
          user_id: user.id,
          name: trimmedName,
          company: leadData.company?.trim() || null,
          confection_type: leadData.confection_type?.trim() || null,
          whatsapp: leadData.whatsapp?.trim() || null,
          email: leadData.email?.trim() || null,
          website: leadData.website?.trim() || null,
          temperature: leadData.temperature || 'morno',
          value: Number(leadData.value) || 0,
          implementation_value: Number(leadData.implementation_value) || 0,
          monthly_value: Number(leadData.monthly_value) || 0,
          stage: 'prospeccao',
          next_contact: leadData.next_contact || null,
          meeting_pain: leadData.meeting_pain?.trim() || null,
          meeting_needs: leadData.meeting_needs?.trim() || null,
          meeting_link: leadData.meeting_link?.trim() || null,
          meeting_date: leadData.meeting_date || null,
          history: history as unknown as Json,
          last_contact: new Date().toISOString(),
          entry_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding lead:', error);
        toast({ title: 'Erro', description: `Erro ao criar lead: ${error.message}`, variant: 'destructive' });
        return null;
      }

      if (!data) {
        toast({ title: 'Erro', description: 'Não foi possível criar o lead', variant: 'destructive' });
        return null;
      }

      toast({ title: 'Sucesso', description: 'Lead criado com sucesso!' });
      return transformDbLead(data);
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
      const newStage = updates.stage ?? currentLead.stage;
      if (updates.stage !== undefined && updates.stage !== currentLead.stage) {
        newHistory = [{
          type: 'stage_change',
          note: `Fase: ${currentLead.stage?.toUpperCase() ?? 'N/A'} → ${updates.stage?.toUpperCase() ?? 'N/A'}`,
          date: new Date().toISOString(),
          user: profile.name?.split(' ')[0] ?? 'Sistema',
        }, ...newHistory];
      }

      const updatePayload = {
        name: (updates.name ?? currentLead.name) || 'Sem nome',
        company: updates.company ?? currentLead.company ?? null,
        confection_type: updates.confection_type ?? currentLead.confection_type ?? null,
        whatsapp: updates.whatsapp ?? currentLead.whatsapp ?? null,
        email: updates.email ?? currentLead.email ?? null,
        website: updates.website ?? currentLead.website ?? null,
        temperature: updates.temperature ?? currentLead.temperature ?? 'morno',
        value: updates.value ?? currentLead.value ?? 0,
        implementation_value: updates.implementation_value ?? currentLead.implementation_value ?? 0,
        monthly_value: updates.monthly_value ?? currentLead.monthly_value ?? 0,
        stage: newStage ?? 'prospeccao',
        loss_reason: updates.loss_reason ?? currentLead.loss_reason ?? null,
        next_contact: updates.next_contact ?? currentLead.next_contact ?? null,
        last_contact: updates.last_contact || new Date().toISOString(),
        meeting_pain: updates.meeting_pain ?? currentLead.meeting_pain ?? null,
        meeting_needs: updates.meeting_needs ?? currentLead.meeting_needs ?? null,
        meeting_link: updates.meeting_link ?? currentLead.meeting_link ?? null,
        meeting_date: updates.meeting_date ?? currentLead.meeting_date ?? null,
        history: newHistory as unknown as Json,
        is_new: false,
        meeting_status: updates.meeting_status ?? currentLead.meeting_status ?? null,
      };

      const { error } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', leadId);

      if (error) {
        console.error('Error updating lead:', error);
        toast({ title: 'Erro', description: `Erro ao atualizar lead: ${error.message}`, variant: 'destructive' });
        return false;
      }

      // Update local state optimistically
      setLeads(prev => prev.map(l => 
        l.id === leadId 
          ? { ...l, ...updatePayload, history: newHistory }
          : l
      ));

      toast({ title: 'Sucesso', description: 'Lead atualizado!' });
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

    const { error } = await supabase
      .from('user_settings')
      .update({
        sales_goal: updates.sales_goal,
        msg_template: updates.msg_template,
      })
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

  const syncActiveCampaign = async (): Promise<{ imported: number; error?: string }> => {
    if (!user) {
      return { imported: 0, error: 'Você precisa estar logado' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-activecampaign');

      if (error) {
        console.error('Error syncing ActiveCampaign:', error);
        toast({ 
          title: 'Erro', 
          description: 'Erro ao sincronizar com ActiveCampaign', 
          variant: 'destructive' 
        });
        return { imported: 0, error: error.message };
      }

      if (data.success) {
        toast({ 
          title: 'Sincronização Concluída', 
          description: `${data.imported} leads importados do ActiveCampaign` 
        });
        return { imported: data.imported };
      } else {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
        return { imported: 0, error: data.error };
      }
    } catch (err) {
      console.error('Unexpected error syncing:', err);
      toast({ 
        title: 'Erro', 
        description: 'Erro inesperado ao sincronizar', 
        variant: 'destructive' 
      });
      return { imported: 0, error: 'Erro inesperado' };
    }
  };

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
  };
}