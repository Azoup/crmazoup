import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { Header } from '@/components/layout/Header';
import { FilterBar } from '@/components/layout/FilterBar';
import { PipelineView } from '@/components/views/PipelineView';
import { AgendaView } from '@/components/views/AgendaView';
import { SalesView } from '@/components/views/SalesView';
import { ManagerView } from '@/components/views/ManagerView';
import { LeadModal } from '@/components/modals/LeadModal';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { Lead } from '@/types/lead';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type ViewType = 'pipeline' | 'agenda' | 'vendas' | 'gestor';

export function Dashboard() {
  const { profile } = useAuth();
  const {
    filteredLeads,
    leads,
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
    syncActiveCampaign,
  } = useLeads();

  const [view, setView] = useState<ViewType>('pipeline');
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [syncing, setSyncing] = useState(false);

  const isManager = profile?.role === 'Gestor';

  const handleSyncAC = async () => {
    setSyncing(true);
    await syncActiveCampaign();
    setSyncing(false);
  };

  const handleOpenLead = (lead: Lead) => {
    setCurrentLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleCloseLead = () => {
    setIsLeadModalOpen(false);
    setCurrentLead(null);
  };

  const handleSaveLead = async (leadData: Partial<Lead>): Promise<boolean> => {
    try {
      let success = false;
      
      if (currentLead) {
        success = await updateLead(currentLead.id, leadData);
      } else {
        const newLead = await addLead(leadData);
        success = newLead !== null;
      }
      
      if (success) {
        handleCloseLead();
      }
      
      return success;
    } catch (err) {
      console.error('Error saving lead:', err);
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-primary h-16" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-96 w-72" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        view={view}
        setView={setView}
        isManager={isManager}
        onProfileOpen={() => setIsProfileOpen(true)}
        leads={leads}
        onSyncActiveCampaign={handleSyncAC}
        syncing={syncing}
      />

      <main className="p-4 md:p-6">
        {(view === 'pipeline' || view === 'agenda') && (
          <FilterBar filters={filters} setFilters={setFilters} />
        )}
        
        {view === 'pipeline' && (
          <PipelineView
            leads={filteredLeads}
            onOpenLead={handleOpenLead}
            getLeadStatus={getLeadStatus}
            updateLead={updateLead}
            addHistory={addHistory}
            msgTemplate={settings?.msg_template || ''}
          />
        )}
        
        {view === 'agenda' && (
          <AgendaView leads={filteredLeads} onOpenLead={handleOpenLead} />
        )}
        
        {view === 'vendas' && (
          <SalesView
            totalSold={totalSold}
            salesGoal={settings?.sales_goal || 50000}
            percentGoal={percentGoal}
            leads={leads}
            onUpdateGoal={(goal) => updateSettings({ sales_goal: goal })}
          />
        )}
        
        {view === 'gestor' && isManager && (
          <ManagerView leads={leads} getLeadStatus={getLeadStatus} percentGoal={percentGoal} />
        )}
      </main>

      <Button
        onClick={() => {
          setCurrentLead(null);
          setIsLeadModalOpen(true);
        }}
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition z-30 border-2 border-primary bg-foreground text-primary"
        size="icon"
      >
        <Plus size={24} strokeWidth={3} />
      </Button>

      {isLeadModalOpen && (
        <LeadModal
          lead={currentLead}
          onClose={handleCloseLead}
          onSave={handleSaveLead}
          onDelete={deleteLead}
          addHistory={addHistory}
          msgTemplate={settings?.msg_template || ''}
          onUpdateTemplate={(template) => updateSettings({ msg_template: template })}
        />
      )}

      {isProfileOpen && (
        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          leads={leads}
          salesGoal={settings?.sales_goal || 50000}
        />
      )}
    </div>
  );
}