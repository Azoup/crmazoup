import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, LeadHistory, LeadFilters, LeadStage, UserSettings } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

function parseHistory(historyJson: Json): LeadHistory[] {
  if (!historyJson) return [];
  if (Array.isArray(historyJson)) {
    return historyJson.map((item: any) => ({
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
  };
}

export function useLeads() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilters>({
    search: '',
    temperature: 'todos',
    confectionType: '',
  });

  useEffect(() => {
    if (!user) {
      setLeads([]);
      setSettings(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

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

    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLeads(prev => [transformDbLead(payload.new), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? transformDbLead(payload.new) : l));
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  const addLead = async (leadData: Partial<Lead>) => {
    if (!user || !profile) {
      toast({ title: 'Erro', description: 'Você precisa estar logado para criar leads', variant: 'destructive' });
      return null;
    }

    if (!leadData.name?.trim()) {
      toast({ title: 'Erro', description: 'O nome do lead é obrigatório', variant: 'destructive' });
      return null;
    }

    const history: LeadHistory[] = [{
      type: 'criacao',
      note: `Lead "${leadData.name}" criado por ${profile.name}`,
      date: new Date().toISOString(),
      user: profile.name.split(' ')[0],
    }];

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          user_id: user.id,
          name: leadData.name.trim(),
          company: leadData.company?.trim() || null,
          confection_type: leadData.confection_type?.trim() || null,
          whatsapp: leadData.whatsapp?.trim() || null,
          email: leadData.email?.trim() || null,
          website: leadData.website?.trim() || null,
          temperature: leadData.temperature || 'morno',
          value: Number(leadData.value) || 0,
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

      toast({ title: 'Sucesso', description: 'Lead criado com sucesso!' });
      return transformDbLead(data);
    } catch (err) {
      console.error('Unexpected error adding lead:', err);
      toast({ title: 'Erro', description: 'Erro inesperado ao criar lead', variant: 'destructive' });
      return null;
    }
  };

  const updateLead = async (leadId: string, updates: Partial<Lead>) => {
    if (!user || !profile) return;

    const currentLead = leads.find(l => l.id === leadId);
    if (!currentLead) return;

    let newHistory = [...(updates.history || currentLead.history)];
    
    if (updates.stage && updates.stage !== currentLead.stage) {
      newHistory = [{
        type: 'stage_change',
        note: `Fase: ${currentLead.stage.toUpperCase()} → ${updates.stage.toUpperCase()}`,
        date: new Date().toISOString(),
        user: profile.name.split(' ')[0],
      }, ...newHistory];
    }

    const { error } = await supabase
      .from('leads')
      .update({
        name: updates.name,
        company: updates.company,
        confection_type: updates.confection_type,
        whatsapp: updates.whatsapp,
        email: updates.email,
        website: updates.website,
        temperature: updates.temperature,
        value: updates.value,
        stage: updates.stage,
        loss_reason: updates.loss_reason,
        next_contact: updates.next_contact,
        last_contact: updates.last_contact || new Date().toISOString(),
        meeting_pain: updates.meeting_pain,
        meeting_needs: updates.meeting_needs,
        meeting_link: updates.meeting_link,
        meeting_date: updates.meeting_date,
        history: newHistory as unknown as Json,
      })
      .eq('id', leadId);

    if (error) {
      console.error('Error updating lead:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar lead', variant: 'destructive' });
      return;
    }

    toast({ title: 'Sucesso', description: 'Lead atualizado!' });
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

  const addHistory = async (leadId: string, type: string, note: string) => {
    if (!user || !profile) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

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
    }
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
      .reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [leads]);

  const percentGoal = useMemo(() => {
    if (!settings?.sales_goal) return 0;
    return Math.min(100, (totalSold / settings.sales_goal) * 100);
  }, [totalSold, settings?.sales_goal]);

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
    percentGoal,
  };
}