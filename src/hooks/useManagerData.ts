import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, LeadHistory } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

interface SDRProfile {
  id: string;
  user_id: string;
  name: string;
  role: string;
  avatar: string | null;
}

interface SDRWithLeads extends SDRProfile {
  leads: Lead[];
}

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
    is_new: dbLead.is_new ?? false,
    manager_notes: dbLead.manager_notes ?? null,
    activecampaign_id: dbLead.activecampaign_id ?? null,
    meeting_status: dbLead.meeting_status ?? null,
    reference_month: dbLead.reference_month ?? null,
  };
}

export function useManagerData() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [sdrs, setSdrs] = useState<SDRWithLeads[]>([]);
  const [sdrIds, setSdrIds] = useState<string[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const isManager = profile?.role === 'Gestor';

  const fetchSDRs = useCallback(async () => {
    if (!user || !isManager) return;

    try {
      // Get SDRs linked to this manager
      const { data: relations } = await supabase
        .from('manager_sdr_relations')
        .select('sdr_id')
        .eq('manager_id', user.id);

      const ids = relations?.map(r => r.sdr_id) || [];
      setSdrIds(ids);

      if (ids.length === 0) {
        setSdrs([]);
        setAllLeads([]);
        setLoading(false);
        return;
      }

      // Fetch SDR profiles
      const { data: sdrProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', ids);

      // Fetch all leads from these SDRs
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .in('user_id', ids)
        .order('created_at', { ascending: false });

      const leadsTyped = (leads || []).map(transformDbLead);

      setAllLeads(leadsTyped);

      // Group leads by SDR
      const sdrsWithLeads: SDRWithLeads[] = (sdrProfiles || []).map(sdr => ({
        ...sdr,
        leads: leadsTyped.filter(l => l.user_id === sdr.user_id)
      }));

      setSdrs(sdrsWithLeads);
    } catch (error) {
      console.error('Error fetching SDR data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isManager]);

  // Set up realtime subscription for SDR leads
  useEffect(() => {
    if (!user || !isManager || sdrIds.length === 0) return;

    // Subscribe to all lead changes and filter client-side
    const channel = supabase
      .channel('manager-leads-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        const newLead = payload.new as any;
        const oldLead = payload.old as any;

        // Only process if the lead belongs to one of our SDRs
        if (payload.eventType === 'INSERT' && sdrIds.includes(newLead?.user_id)) {
          const transformedLead = transformDbLead(newLead);
          setAllLeads(prev => [transformedLead, ...prev]);
          setSdrs(prev => prev.map(sdr => 
            sdr.user_id === newLead.user_id 
              ? { ...sdr, leads: [transformedLead, ...sdr.leads] }
              : sdr
          ));
        } else if (payload.eventType === 'UPDATE' && sdrIds.includes(newLead?.user_id)) {
          const transformedLead = transformDbLead(newLead);
          setAllLeads(prev => prev.map(l => l.id === newLead.id ? transformedLead : l));
          setSdrs(prev => prev.map(sdr => ({
            ...sdr,
            leads: sdr.leads.map(l => l.id === newLead.id ? transformedLead : l)
          })));
        } else if (payload.eventType === 'DELETE' && sdrIds.includes(oldLead?.user_id)) {
          setAllLeads(prev => prev.filter(l => l.id !== oldLead.id));
          setSdrs(prev => prev.map(sdr => ({
            ...sdr,
            leads: sdr.leads.filter(l => l.id !== oldLead.id)
          })));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isManager, sdrIds]);

  const addSDR = async (email: string) => {
    if (!user) return;

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'SDR');

      toast({ 
        title: 'Info', 
        description: 'Para adicionar um SDR, peça que ele compartilhe seu ID de usuário após fazer login.' 
      });
      
      return profiles;
    } catch (error) {
      console.error('Error adding SDR:', error);
      toast({ title: 'Erro', description: 'Erro ao buscar SDRs', variant: 'destructive' });
    }
  };

  const addSDRById = async (sdrUserId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('manager_sdr_relations')
        .insert({
          manager_id: user.id,
          sdr_id: sdrUserId
        });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Info', description: 'Este SDR já está vinculado a você' });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: 'Sucesso', description: 'SDR adicionado com sucesso!' });
      fetchSDRs();
    } catch (error) {
      console.error('Error adding SDR:', error);
      toast({ title: 'Erro', description: 'Erro ao adicionar SDR', variant: 'destructive' });
    }
  };

  const removeSDR = async (sdrUserId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('manager_sdr_relations')
        .delete()
        .eq('manager_id', user.id)
        .eq('sdr_id', sdrUserId);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'SDR removido da sua equipe' });
      fetchSDRs();
    } catch (error) {
      console.error('Error removing SDR:', error);
      toast({ title: 'Erro', description: 'Erro ao remover SDR', variant: 'destructive' });
    }
  };

  const updateLeadManagerNotes = async (leadId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ manager_notes: notes })
        .eq('id', leadId);

      if (error) throw error;

      setAllLeads(prev => prev.map(l => 
        l.id === leadId ? { ...l, manager_notes: notes } : l
      ));

      setSdrs(prev => prev.map(sdr => ({
        ...sdr,
        leads: sdr.leads.map(l => l.id === leadId ? { ...l, manager_notes: notes } : l)
      })));

      toast({ title: 'Sucesso', description: 'Notas do gestor salvas!' });
    } catch (error) {
      console.error('Error updating manager notes:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar notas', variant: 'destructive' });
    }
  };

  const syncActiveCampaign = async () => {
    if (!user) return;

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-activecampaign');

      if (error) throw error;

      if (data.success) {
        toast({ 
          title: 'Sincronização Concluída', 
          description: `${data.imported} leads importados do ActiveCampaign` 
        });
        fetchSDRs();
      } else {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error syncing ActiveCampaign:', error);
      toast({ 
        title: 'Erro', 
        description: 'Erro ao sincronizar com ActiveCampaign', 
        variant: 'destructive' 
      });
    } finally {
      setSyncing(false);
    }
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

  useEffect(() => {
    if (isManager) {
      fetchSDRs();
    } else {
      setLoading(false);
    }
  }, [isManager, fetchSDRs]);

  return {
    sdrs,
    allLeads,
    loading,
    syncing,
    isManager,
    addSDR,
    addSDRById,
    removeSDR,
    updateLeadManagerNotes,
    syncActiveCampaign,
    refreshData: fetchSDRs,
    getLeadStatus,
  };
}
