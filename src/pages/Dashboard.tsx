import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { useToast } from '@/hooks/use-toast';
import { useMeetingReminder } from '@/hooks/useMeetingReminder';
import { Header } from '@/components/layout/Header';
import { FilterBar } from '@/components/layout/FilterBar';
import { PipelineView } from '@/components/views/PipelineView';
import { WeeklyAgendaView } from '@/components/views/WeeklyAgendaView';
import { SalesView } from '@/components/views/SalesView';
import { QualificationView } from '@/components/views/QualificationView';
import { ManagerView } from '@/components/views/ManagerView';
import { LeadModal } from '@/components/modals/LeadModal';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { MeetingStatusModal } from '@/components/modals/MeetingStatusModal';
import { Lead, MeetingStatus } from '@/types/lead';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type ViewType = 'pipeline' | 'agenda' | 'vendas' | 'qualificacao' | 'gestor';

export function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
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
    totalImplementation,
    totalMonthly,
    percentGoal,
    syncActiveCampaign,
  } = useLeads();

  const [view, setView] = useState<ViewType>('pipeline');
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Hook to monitor past meetings and prompt for status
  const { pendingReminder, dismissReminder, clearReminder } = useMeetingReminder(leads);

  const isManager = profile?.role === 'Gestor';

  const handleSyncAC = async () => {
    setSyncing(true);
    await syncActiveCampaign();
    setSyncing(false);
  };

  const handleGoogleCalendarSync = () => {
    toast({
      title: '🚧 Em Desenvolvimento',
      description: 'A integração com Google Agenda está sendo desenvolvida. Em breve você poderá sincronizar suas reuniões automaticamente!',
      duration: 5000,
    });
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
      
      // Validate required field
      if (!leadData.name?.trim()) {
        toast({
          title: 'Erro',
          description: 'O nome do lead é obrigatório',
          variant: 'destructive',
        });
        return false;
      }
      
      if (currentLead) {
        success = await updateLead(currentLead.id, leadData);
      } else {
        const newLead = await addLead(leadData);
        success = newLead !== null;
      }
      
      if (success) {
        // Close modal only after confirmed success
        handleCloseLead();
      }
      
      return success;
    } catch (err) {
      console.error('Error saving lead:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar lead. Tente novamente.',
        variant: 'destructive',
      });
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
          <WeeklyAgendaView 
            leads={filteredLeads} 
            onOpenLead={handleOpenLead}
            onGoogleCalendarSync={handleGoogleCalendarSync}
          />
        )}
        
        {view === 'vendas' && (
          <SalesView
            totalSold={totalSold}
            totalImplementation={totalImplementation}
            totalMonthly={totalMonthly}
            salesGoal={settings?.sales_goal || 50000}
            percentGoal={percentGoal}
            leads={leads}
            onUpdateGoal={(goal) => updateSettings({ sales_goal: goal })}
          />
        )}
        
        {view === 'qualificacao' && (
          <QualificationView leads={leads} />
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

      {/* Auto popup for past meetings without status */}
      {pendingReminder && (
        <MeetingStatusModal
          lead={pendingReminder}
          onClose={() => dismissReminder(pendingReminder.id)}
          onSelectStatus={async (leadId, status) => {
            await updateLead(leadId, { meeting_status: status });
            
            // Add history entry
            const statusLabels: Record<string, string> = {
              compareceu: '✅ Compareceu à reunião',
              no_show: '❌ No Show - não compareceu',
              reagendar: '📅 Reunião reagendada',
            };
            
            if (status) {
              await addHistory(leadId, 'reuniao_status', statusLabels[status] || 'Status de reunião atualizado');
            }
            
            clearReminder();
            toast({
              title: 'Status atualizado',
              description: `Reunião marcada como: ${statusLabels[status || ''] || status}`,
            });
          }}
        />
      )}
    </div>
  );
}