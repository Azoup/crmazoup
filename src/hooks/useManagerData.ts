import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, LeadHistory } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';

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

export function useManagerData() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [sdrs, setSdrs] = useState<SDRWithLeads[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const isManager = profile?.role === 'Gestor';

  const fetchSDRs = async () => {
    if (!user || !isManager) return;

    try {
      // Get SDRs linked to this manager
      const { data: relations } = await supabase
        .from('manager_sdr_relations')
        .select('sdr_id')
        .eq('manager_id', user.id);

      const sdrIds = relations?.map(r => r.sdr_id) || [];

      if (sdrIds.length === 0) {
        setSdrs([]);
        setAllLeads([]);
        return;
      }

      // Fetch SDR profiles
      const { data: sdrProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', sdrIds);

      // Fetch all leads from these SDRs
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .in('user_id', sdrIds)
        .order('created_at', { ascending: false });

      const leadsTyped = (leads || []).map(l => ({
        ...l,
        history: (Array.isArray(l.history) ? l.history : []) as unknown as LeadHistory[]
      })) as Lead[];

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
  };

  const addSDR = async (email: string) => {
    if (!user) return;

    try {
      // Find user by email in profiles (we need to look up by email in auth)
      // Since we can't query auth.users, we'll need the user to provide the SDR's user_id
      // For now, let's query profiles and match by name/email pattern
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'SDR');

      // This is a workaround - in production you'd want a better way to find users
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

  useEffect(() => {
    if (isManager) {
      fetchSDRs();
    } else {
      setLoading(false);
    }
  }, [user, isManager]);

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
  };
}
