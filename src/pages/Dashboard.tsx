import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { useToast } from '@/hooks/use-toast';
import { useMeetingReminder } from '@/hooks/useMeetingReminder';
import { useProposalReminder } from '@/hooks/useProposalReminder';
import { useMeetingAlert } from '@/hooks/useMeetingAlert';
import { useReturnReminder } from '@/hooks/useReturnReminder';
import { useNewSystemReminder } from '@/hooks/useNewSystemReminder';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { FilterBar } from '@/components/layout/FilterBar';

import { PipelineView } from '@/components/views/PipelineView';
import { ManualPipelineView } from '@/components/views/ManualPipelineView';
import { WeeklyAgendaView } from '@/components/views/WeeklyAgendaView';
import { SalesView } from '@/components/views/SalesView';
import { QualificationView } from '@/components/views/QualificationView';
import { ManagerView } from '@/components/views/ManagerView';
import { ReportView } from '@/components/views/ReportView';
import { WhatsAppView } from '@/components/views/WhatsAppView';
import { LeadModal } from '@/components/modals/LeadModal';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { MeetingStatusModal } from '@/components/modals/MeetingStatusModal';
import { ProposalReminderModal } from '@/components/modals/ProposalReminderModal';
import { MeetingAlertModal } from '@/components/modals/MeetingAlertModal';
import { ReturnReminderModal } from '@/components/modals/ReturnReminderModal';
import { Lead, LeadSource, NextContactType } from '@/types/lead';
import { formatScheduledReturnNote } from '@/lib/contactFollowUp';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyNewLeadsCarousel } from '@/components/leads/DailyNewLeadsCarousel';
import { CommandPalette } from '@/components/leads/CommandPalette';
import { AlertsWidget } from '@/components/leads/AlertsWidget';


type ViewType = 'pipeline' | 'prospeccao_ativa' | 'indicacao' | 'agenda' | 'vendas' | 'qualificacao' | 'relatorios' | 'whatsapp' | 'gestor';

export function Dashboard() {
  const { user, profile } = useAuth();
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
  const [createLeadSource, setCreateLeadSource] = useState<LeadSource>('marketing');

  const isManager = profile?.role === 'Gestor';

  const pipelineCarouselLeads = useMemo(
    () =>
      filteredLeads.filter(
        (l) => l.user_id === user?.id && (l.lead_source === 'marketing' || !l.lead_source),
      ),
    [filteredLeads, user?.id],
  );

  const prospeccaoAtivaCarouselLeads = useMemo(
    () => leads.filter((l) => l.user_id === user?.id && l.lead_source === 'prospeccao_ativa'),
    [leads, user?.id],
  );

  const indicacaoCarouselLeads = useMemo(
    () => leads.filter((l) => l.user_id === user?.id && l.lead_source === 'indicacao'),
    [leads, user?.id],
  );

  // Hook to monitor past meetings and prompt for status
  const { pendingReminder, dismissReminder, clearReminder } = useMeetingReminder(leads);
  // Proposal reminder desativado para o gestor (sem pop-ups de retorno na aba gestor)
  const { pendingProposal, dismissProposalReminder } = useProposalReminder([]);
  // 15-min pre-meeting alert
  const { alertLead, dismissAlert } = useMeetingAlert(leads);
  // Return contact reminder
  const {
    pendingReturn,
    markReturnCompleted,
    clearReturnCompleted,
    dismissReturn,
    snoozeAll,
    canSnooze,
    snoozeCount,
    snoozeShort,
    canShortSnooze,
    shortSnoozeCount,
  } = useReturnReminder(isManager ? [] : leads);

  useNewSystemReminder(isManager ? [] : leads);

  const handleScheduleReturn = async (
    leadId: string,
    nextContact: string,
    contactType: NextContactType,
  ): Promise<boolean> => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return false;

    const ok = await updateLead(leadId, {
      next_contact: nextContact,
      next_contact_type: contactType,
      is_new: false,
      last_contact: new Date().toISOString(),
    });
    if (!ok) return false;

    clearReturnCompleted(leadId);
    await addHistory(leadId, 'retorno', formatScheduledReturnNote(nextContact, contactType, lead));
    toast({
      title: 'Retorno agendado',
      description: new Date(nextContact).toLocaleString('pt-BR'),
    });
    return true;
  };

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
    setCreateLeadSource((lead.lead_source as LeadSource) || 'marketing');
    setIsLeadModalOpen(true);
  };

  const handleOpenNewLead = (source: LeadSource = 'marketing') => {
    setCurrentLead(null);
    setCreateLeadSource(source);
    setIsLeadModalOpen(true);
  };

  const handleCloseLead = () => {
    setIsLeadModalOpen(false);
    setCurrentLead(null);
    setCreateLeadSource('marketing');
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
        const newLead = await addLead({ ...leadData, lead_source: createLeadSource });
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
      <CommandPalette
        leads={leads}
        onOpenLead={handleOpenLead}
        onCreateLead={() => handleOpenNewLead('marketing')}
        onGoToReports={() => setView('relatorios')}
      />
      <Header
        view={view}
        setView={setView}
        isManager={isManager}
        onProfileOpen={() => setIsProfileOpen(true)}
        leads={leads}
        onSyncActiveCampaign={handleSyncAC}
        syncing={syncing}
        salesGoal={settings?.sales_goal || 50000}
        percentGoal={percentGoal}
      />


      <main className="p-4 md:p-6">
        {(view === 'pipeline' || view === 'agenda') && (
          <FilterBar filters={filters} setFilters={setFilters} />
        )}

        {view === 'pipeline' && !isManager && (
          <AlertsWidget
            leads={leads.filter((l) => l.user_id === user?.id)}
            onOpenLead={handleOpenLead}
          />
        )}


        {!isManager && view === 'pipeline' && (
          <DailyNewLeadsCarousel
            leads={pipelineCarouselLeads}
            onOpenLead={handleOpenLead}
            getLeadStatus={getLeadStatus}
            addHistory={addHistory}
            onScheduleReturn={handleScheduleReturn}
            msgTemplate={settings?.msg_template || ''}
          />
        )}

        {!isManager && view === 'prospeccao_ativa' && (
          <DailyNewLeadsCarousel
            leads={prospeccaoAtivaCarouselLeads}
            onOpenLead={handleOpenLead}
            getLeadStatus={getLeadStatus}
            addHistory={addHistory}
            onScheduleReturn={handleScheduleReturn}
            msgTemplate={settings?.msg_template || ''}
          />
        )}

        {!isManager && view === 'indicacao' && (
          <DailyNewLeadsCarousel
            leads={indicacaoCarouselLeads}
            onOpenLead={handleOpenLead}
            getLeadStatus={getLeadStatus}
            addHistory={addHistory}
            onScheduleReturn={handleScheduleReturn}
            msgTemplate={settings?.msg_template || ''}
          />
        )}
        
        {view === 'pipeline' && (
          <PipelineView
            leads={filteredLeads.filter(l => l.user_id === user?.id && (l.lead_source === 'marketing' || !l.lead_source))}
            onOpenLead={handleOpenLead}
            getLeadStatus={getLeadStatus}
            updateLead={updateLead}
            addHistory={addHistory}
            msgTemplate={settings?.msg_template || ''}
          />
        )}

        {view === 'prospeccao_ativa' && (
          <ManualPipelineView
            leads={leads.filter(l => l.user_id === user?.id)}
            allLeads={leads.filter(l => l.user_id === user?.id)}
            source="prospeccao_ativa"
            sourceLabel="Prospecção Ativa"
            onOpenLead={handleOpenLead}
            onCreateLead={handleOpenNewLead}
            getLeadStatus={getLeadStatus}
            updateLead={updateLead}
            addHistory={addHistory}
            addLead={addLead}
            deleteLead={deleteLead}
            msgTemplate={settings?.msg_template || ''}
            onUpdateTemplate={(template) => updateSettings({ msg_template: template })}
          />
        )}

        {view === 'indicacao' && (
          <ManualPipelineView
            leads={leads.filter(l => l.user_id === user?.id)}
            allLeads={leads.filter(l => l.user_id === user?.id)}
            source="indicacao"
            sourceLabel="Indicação"
            onOpenLead={handleOpenLead}
            onCreateLead={handleOpenNewLead}
            getLeadStatus={getLeadStatus}
            updateLead={updateLead}
            addHistory={addHistory}
            addLead={addLead}
            deleteLead={deleteLead}
            msgTemplate={settings?.msg_template || ''}
            onUpdateTemplate={(template) => updateSettings({ msg_template: template })}
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

        {view === 'relatorios' && (
          <ReportView leads={leads} />
        )}

        {view === 'whatsapp' && (
          <WhatsAppView leads={leads} />
        )}
        
        {view === 'gestor' && isManager && (
          <ManagerView
            leads={leads}
            getLeadStatus={getLeadStatus}
            percentGoal={percentGoal}
            onCreateLead={handleOpenNewLead}
            onOpenLead={handleOpenLead}
            updateLead={updateLead}
            addHistory={addHistory}
          />
        )}
      </main>

      <Button
        onClick={() => {
          const modalSource: LeadSource = view === 'prospeccao_ativa' || view === 'indicacao' ? view : 'marketing';
          handleOpenNewLead(modalSource);
        }}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 z-30 bg-primary text-primary-foreground"
        size="icon"
      >
        <Plus size={22} strokeWidth={2.5} />
      </Button>

      {isLeadModalOpen && (
        <LeadModal
          lead={currentLead}
          draftScope={createLeadSource}
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
          meetingGoal={settings?.meeting_goal || 0}
          onUpdateSettings={updateSettings}
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

      {pendingProposal && (
        <ProposalReminderModal
          lead={pendingProposal}
          onClose={async (newNextContact?: string) => {
            if (newNextContact) {
              await updateLead(pendingProposal.id, { next_contact: newNextContact });
              await addHistory(pendingProposal.id, 'retorno', `📅 Retorno reagendado para ${new Date(newNextContact).toLocaleString('pt-BR')}`);
            }
            dismissProposalReminder(pendingProposal.id);
          }}
        />
      )}

      {/* 15-min pre-meeting alert */}
      {alertLead && (
        <MeetingAlertModal
          lead={alertLead}
          onDismiss={() => dismissAlert(alertLead.id)}
          onOpenLead={(lead) => {
            dismissAlert(lead.id);
            handleOpenLead(lead);
          }}
        />
      )}

      {/* Return contact reminder */}
      {pendingReturn && (
        <ReturnReminderModal
          lead={pendingReturn}
          onReturnCompleted={async (leadId, nextContact, moveToStage, lossReason, nextContactType) => {
            markReturnCompleted(leadId, Boolean(nextContact));
            const lead = leads.find((l) => l.id === leadId);
            const updates: Partial<Lead> = {};
            if (nextContact) updates.next_contact = nextContact;
            if (nextContactType) updates.next_contact_type = nextContactType;
            if (moveToStage) updates.stage = moveToStage;
            if (lossReason) updates.loss_reason = lossReason;
            updates.last_contact = new Date().toISOString();
            await updateLead(leadId, updates);
            const stageLabels: Record<string, string> = {
              congelados: '❄️ Lead congelado via retorno',
              perdidos: '❌ Lead descartado via retorno',
              reuniao: '📅 Reunião agendada via retorno',
            };
            if (moveToStage) {
              const base = stageLabels[moveToStage] || '✅ Retorno realizado';
              const withReason = lossReason ? `${base} · Motivo: ${lossReason}` : base;
              const withNext =
                nextContact && lead && nextContactType
                  ? `${withReason} · Próximo: ${formatScheduledReturnNote(nextContact, nextContactType, lead).replace('📅 Retorno agendado ', '')}`
                  : withReason;
              await addHistory(leadId, 'retorno', withNext);
            } else if (nextContact && lead && nextContactType) {
              await addHistory(
                leadId,
                'retorno',
                `${formatScheduledReturnNote(nextContact, nextContactType, lead)} (após contato)`,
              );
            } else {
              await addHistory(leadId, 'retorno', '✅ Nova tentativa de contato realizada');
            }
          }}
          onDismiss={dismissReturn}
          onSnoozeAll={snoozeAll}
          onSnoozeShort={snoozeShort}
          canSnooze={canSnooze}
          snoozeCount={snoozeCount}
          canShortSnooze={canShortSnooze}
          shortSnoozeCount={shortSnoozeCount}
        />
      )}
    </div>
  );
}