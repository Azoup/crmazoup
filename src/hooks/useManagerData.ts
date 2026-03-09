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
    responsible_user_id: dbLead.responsible_user_id ?? null,
  };
}

export function useManagerData() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [sdrs, setSdrs] = useState<SDRWithLeads[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const isManager = profile?.role === 'Gestor';

  const fetchSDRs = useCallback(async () => {
    if (!user || !isManager) return;

    setLoading(true);
    try {
      // Get SDRs linked to this manager
      const { data: relations } = await supabase
        .from('manager_sdr_relations')
        .select('sdr_id')
        .eq('manager_id', user.id);

      const ids = relations?.map(r => r.sdr_id) || [];

      // Fetch SDR profiles AND manager's own profile in parallel
      const [sdrProfilesResult, managerProfileResult, leadsResult] = await Promise.all([
        ids.length > 0
          ? supabase.from('profiles').select('*').in('user_id', ids)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
      ]);

      const sdrProfiles = sdrProfilesResult.data || [];
      const managerProfile = managerProfileResult.data;
      const leadsTyped = (leadsResult.data || []).map(transformDbLead);
      setAllLeads(leadsTyped);

      // Build SDR list including the manager themselves
      const allProfiles: SDRWithLeads[] = [];

      // Add manager's own profile first
      if (managerProfile) {
        allProfiles.push({
          ...managerProfile,
          leads: leadsTyped.filter(l => l.user_id === managerProfile.user_id),
        });
      }

      // Add SDR profiles
      sdrProfiles.forEach((sdr: any) => {
        allProfiles.push({
          ...sdr,
          leads: leadsTyped.filter(l => l.user_id === sdr.user_id),
        });
      });

      setSdrs(allProfiles);
    } catch (error) {
      console.error('Error fetching SDR data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isManager]);

  // Set up realtime subscription for all leads visible to manager
  useEffect(() => {
    if (!user || !isManager) return;

    const channel = supabase
      .channel('manager-leads-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        const newLead = payload.new as any;
        const oldLead = payload.old as any;

        if (payload.eventType === 'INSERT' && newLead?.id) {
          const transformedLead = transformDbLead(newLead);
          setAllLeads(prev => prev.some(l => l.id === transformedLead.id) ? prev : [transformedLead, ...prev]);
          setSdrs(prev => prev.map(sdr =>
            sdr.user_id === newLead.user_id
              ? { ...sdr, leads: sdr.leads.some(l => l.id === transformedLead.id) ? sdr.leads : [transformedLead, ...sdr.leads] }
              : sdr
          ));
          return;
        }

        if (payload.eventType === 'UPDATE' && newLead?.id) {
          const transformedLead = transformDbLead(newLead);
          setAllLeads(prev => {
            const exists = prev.some(l => l.id === transformedLead.id);
            if (!exists) return [transformedLead, ...prev];
            return prev.map(l => l.id === transformedLead.id ? transformedLead : l);
          });
          setSdrs(prev => prev.map(sdr => ({
            ...sdr,
            leads: sdr.leads.some(l => l.id === transformedLead.id)
              ? sdr.leads.map(l => l.id === transformedLead.id ? transformedLead : l)
              : (sdr.user_id === newLead.user_id ? [transformedLead, ...sdr.leads] : sdr.leads)
          })));
          return;
        }

        if (payload.eventType === 'DELETE' && oldLead?.id) {
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
  }, [user?.id, isManager]);

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
      const currentLead = allLeads.find(l => l.id === leadId);
      if (!currentLead) {
        toast({ title: 'Erro', description: 'Lead não encontrado', variant: 'destructive' });
        return;
      }

      const newHistoryEntry: LeadHistory = {
        type: 'nota_gestor',
        note: `📋 Nota do Gestor: ${notes}`,
        date: new Date().toISOString(),
        user: profile?.name.split(' ')[0] || 'Gestor',
      };

      const updatedHistory = [newHistoryEntry, ...(currentLead.history || [])];

      const { error } = await supabase
        .from('leads')
        .update({ 
          manager_notes: notes,
          history: updatedHistory as any
        })
        .eq('id', leadId);

      if (error) throw error;

      setAllLeads(prev => prev.map(l => 
        l.id === leadId ? { ...l, manager_notes: notes, history: updatedHistory } : l
      ));

      setSdrs(prev => prev.map(sdr => ({
        ...sdr,
        leads: sdr.leads.map(l => l.id === leadId ? { ...l, manager_notes: notes, history: updatedHistory } : l)
      })));

      toast({ title: 'Sucesso', description: 'Notas do gestor salvas e registradas no histórico!' });
    } catch (error) {
      console.error('Error updating manager notes:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar notas', variant: 'destructive' });
    }
  };

  const updateLeadResponsible = async (leadId: string, responsibleUserId: string) => {
    try {
      const currentLead = allLeads.find(l => l.id === leadId);
      if (!currentLead) return;

      const responsibleName = responsibleUserId === user?.id 
        ? profile?.name || 'Gestor'
        : sdrs.find(s => s.user_id === responsibleUserId)?.name || 'SDR';

      const newHistoryEntry: LeadHistory = {
        type: 'sistema',
        note: `👤 Responsável alterado para: ${responsibleName}`,
        date: new Date().toISOString(),
        user: profile?.name.split(' ')[0] || 'Gestor',
      };

      const updatedHistory = [newHistoryEntry, ...(currentLead.history || [])];

      const { error } = await supabase
        .from('leads')
        .update({ 
          responsible_user_id: responsibleUserId,
          history: updatedHistory as any
        })
        .eq('id', leadId);

      if (error) throw error;

      setAllLeads(prev => prev.map(l => 
        l.id === leadId ? { ...l, responsible_user_id: responsibleUserId, history: updatedHistory } : l
      ));

      setSdrs(prev => prev.map(sdr => ({
        ...sdr,
        leads: sdr.leads.map(l => l.id === leadId ? { ...l, responsible_user_id: responsibleUserId, history: updatedHistory } : l)
      })));

      toast({ title: 'Sucesso', description: `Responsável alterado para ${responsibleName}` });
    } catch (error) {
      console.error('Error updating responsible:', error);
      toast({ title: 'Erro', description: 'Erro ao alterar responsável', variant: 'destructive' });
    }
  };

  const deleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      setAllLeads(prev => prev.filter(l => l.id !== leadId));
      setSdrs(prev => prev.map(sdr => ({
        ...sdr,
        leads: sdr.leads.filter(l => l.id !== leadId)
      })));

      toast({ title: 'Sucesso', description: 'Lead excluído com sucesso!' });
      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir lead', variant: 'destructive' });
      return false;
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

  const addLead = async (leadData: Partial<Lead>): Promise<Lead | null> => {
    if (!user || !profile) {
      toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
      return null;
    }

    const trimmedName = leadData.name?.trim();
    if (!trimmedName) {
      toast({ title: 'Erro', description: 'O nome do lead é obrigatório', variant: 'destructive' });
      return null;
    }

    const history: LeadHistory[] = [{
      type: 'criacao',
      note: `Lead "${trimmedName}" criado por ${profile.name ?? 'Gestor'}`,
      date: new Date().toISOString(),
      user: profile.name?.split(' ')[0] ?? 'Gestor',
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
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding lead (manager):', error);
        toast({ title: 'Erro', description: `Erro ao criar lead: ${error.message}`, variant: 'destructive' });
        return null;
      }

      if (!data) {
        toast({ title: 'Erro', description: 'Não foi possível criar o lead', variant: 'destructive' });
        return null;
      }

      const createdLead = transformDbLead(data);
      // Update local state immediately
      setAllLeads(prev => (prev.some(l => l.id === createdLead.id) ? prev : [createdLead, ...prev]));

      toast({ title: 'Sucesso', description: 'Lead criado com sucesso!' });
      return createdLead;
    } catch (err) {
      console.error('Unexpected error adding lead (manager):', err);
      toast({ title: 'Erro', description: 'Erro inesperado ao criar lead', variant: 'destructive' });
      return null;
    }
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
    addLead,
    removeSDR,
    updateLeadManagerNotes,
    updateLeadResponsible,
    deleteLead,
    syncActiveCampaign,
    refreshData: fetchSDRs,
    getLeadStatus,
  };
}
