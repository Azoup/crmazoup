import { Lead, LeadStage, LeadHistory, STAGE_COLORS, STAGE_LABELS, MEETING_STATUS_LABELS } from '@/types/lead';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Users, Sparkles, UserCheck, UserX, Calendar } from 'lucide-react';
import { useCelebration } from '@/hooks/useCelebration';

interface ManagerPipelineViewProps {
  leads: Lead[];
  sdrs: { user_id: string; name: string; avatar: string | null }[];
  getLeadStatus: (lead: Lead) => 'late' | 'today' | 'ontime' | 'neutral';
  onLeadClick?: (lead: Lead) => void;
  selectedSDR: string | null;
  updateLead?: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
  addHistory?: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
}

const COLUMNS: { id: LeadStage; title: string }[] = [
  { id: 'prospeccao', title: 'Prospecção' },
  { id: 'interesse', title: 'Interesse' },
  { id: 'reuniao', title: 'Reunião' },
  { id: 'proposta', title: 'Proposta' },
  { id: 'venda', title: 'Venda' },
  { id: 'congelados', title: 'Congelados' },
  { id: 'perdidos', title: 'Perdidos' },
];

export function ManagerPipelineView({ 
  leads, 
  sdrs,
  getLeadStatus, 
  onLeadClick,
  selectedSDR,
  updateLead,
  addHistory,
}: ManagerPipelineViewProps) {
  const { celebrateMeeting, celebrateSale } = useCelebration();

  // Filter leads by selected SDR
  const filteredLeads = selectedSDR 
    ? leads.filter(l => l.user_id === selectedSDR)
    : leads;

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    if (!updateLead) return;
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    const lead = filteredLeads.find(l => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    if (targetStage === 'reuniao' && lead.stage !== 'reuniao') {
      celebrateMeeting();
    }

    const updates: Partial<Lead> = { stage: targetStage };

    if (targetStage === 'venda') {
      if (!lead.value) {
        const val = prompt("Qual o valor da venda (R$)?") || '0';
        updates.value = Number(val.replace(/\D/g, ''));
      }
      celebrateSale();
    }

    if (targetStage === 'perdidos') {
      const options = ['Preço', 'Sem Interesse', 'Já possui sistema', 'Não Responde', 'Pequeno', 'Fechou com outra empresa', 'Deixou pro futuro', 'Private Label', 'Outro'];
      const reason = prompt(`Motivo da perda?\n\nOpções:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nDigite o número ou o motivo:`) || 'Não Informado';
      const numChoice = parseInt(reason);
      updates.loss_reason = (numChoice >= 1 && numChoice <= options.length) ? options[numChoice - 1] : reason;
    }

    await updateLead(leadId, updates);
  };

  const totalPipelineValue = filteredLeads.reduce((acc, curr) => 
    acc + (curr.implementation_value || 0) + (curr.monthly_value || 0), 0);

  const getSDRName = (userId: string) => {
    const sdr = sdrs.find(s => s.user_id === userId);
    return sdr?.name?.split(' ')[0] || 'SDR';
  };

  const getSDRColor = (userId: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'
    ];
    const index = sdrs.findIndex(s => s.user_id === userId);
    return colors[index % colors.length];
  };

  const getMeetingStatusIcon = (status: string | null | undefined) => {
    if (status === 'compareceu') return <UserCheck size={12} className="text-success" />;
    if (status === 'no_show') return <UserX size={12} className="text-destructive" />;
    if (status === 'reagendar') return <Calendar size={12} className="text-warning" />;
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="text-xs text-muted-foreground">
          {selectedSDR 
            ? `Visualizando: ${getSDRName(selectedSDR)}`
            : `Todos os SDRs (${sdrs.length})`
          }
        </div>
        <div className="bg-card px-3 py-1 rounded-full border shadow-sm text-xs font-bold text-muted-foreground flex items-center gap-2">
          <DollarSign size={12} className="text-success" /> 
          Total em Oportunidades: 
          <span className="text-success text-sm">{formatCurrency(totalPipelineValue)}</span>
        </div>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-320px)] scrollbar-thin">
        {COLUMNS.map(col => {
          const colLeads = filteredLeads.filter(l => l.stage === col.id);
          const colValue = colLeads.reduce((acc, curr) => 
            acc + (curr.implementation_value || 0) + (curr.monthly_value || 0), 0);
          
          return (
            <div
              key={col.id}
              className="min-w-[280px] w-[280px] bg-card rounded-xl shadow-sm border border-border flex flex-col flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className={`p-3 border-b-4 ${STAGE_COLORS[col.id]} bg-muted rounded-t-xl`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-foreground text-sm">{col.title}</span>
                  <span className="bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full text-xs font-bold">
                    {colLeads.length}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <DollarSign size={10} /> {formatCurrency(colValue)}
                </div>
              </div>
              
              <div className="p-2 flex-1 overflow-y-auto bg-muted/50 space-y-2 min-h-[200px] scrollbar-thin">
                {colLeads.map(lead => {
                  const status = getLeadStatus(lead);
                  
                  return (
                    <div
                      key={lead.id}
                      onClick={() => onLeadClick?.(lead)}
                      className={`bg-card p-3 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-all ${
                        status === 'late' ? 'border-l-4 border-l-destructive' :
                        status === 'today' ? 'border-l-4 border-l-warning' :
                        'border-border'
                      } ${lead.is_new ? 'ring-2 ring-purple-500/50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            {lead.is_new && <Sparkles size={12} className="text-purple-500 flex-shrink-0" />}
                            <span className="font-medium text-sm text-foreground truncate">
                              {lead.name}
                            </span>
                          </div>
                          {lead.company && (
                            <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                          )}
                        </div>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          lead.temperature === 'quente' ? 'bg-temp-hot' :
                          lead.temperature === 'morno' ? 'bg-temp-warm' : 'bg-temp-cold'
                        }`} />
                      </div>

                      {/* SDR Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`${getSDRColor(lead.user_id)} w-5 h-5 rounded-full flex items-center justify-center`}>
                          <Users size={10} className="text-white" />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {getSDRName(lead.user_id)}
                        </span>
                      </div>

                      {/* Meeting Status */}
                      {lead.stage === 'reuniao' && lead.meeting_status && (
                        <div className="flex items-center gap-1 mb-2 text-xs">
                          {getMeetingStatusIcon(lead.meeting_status)}
                          <span className="text-muted-foreground">
                            {MEETING_STATUS_LABELS[lead.meeting_status] || lead.meeting_status}
                          </span>
                        </div>
                      )}

                      {/* Values */}
                      {((lead.implementation_value || 0) > 0 || (lead.monthly_value || 0) > 0) && (
                        <div className="flex gap-2 text-[10px]">
                          {(lead.implementation_value || 0) > 0 && (
                            <span className="text-primary font-bold">
                              Impl: {formatCurrency(lead.implementation_value || 0)}
                            </span>
                          )}
                          {(lead.monthly_value || 0) > 0 && (
                            <span className="text-success font-bold">
                              Mens: {formatCurrency(lead.monthly_value || 0)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Status indicators */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                        <span className={`text-[10px] font-bold ${
                          status === 'late' ? 'text-destructive' :
                          status === 'today' ? 'text-warning' :
                          'text-muted-foreground'
                        }`}>
                          {status === 'late' ? '⚠️ Atrasado' :
                           status === 'today' ? '📅 Hoje' :
                           lead.next_contact ? `📆 ${new Date(lead.next_contact).toLocaleDateString('pt-BR')}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
