import { useState } from 'react';
import { Lead, LeadStage, LeadHistory, MeetingStatus, STAGE_COLORS } from '@/types/lead';
import { LeadCard } from '@/components/leads/LeadCard';
import { formatCurrency, cleanPhoneNumber } from '@/lib/utils';
import { DollarSign, Trash2, CheckSquare, XCircle, Sparkles, MessageCircle, Ban, Plus, TrendingUp, CalendarClock, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCelebration } from '@/hooks/useCelebration';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PipelineSortMenu, sortLeads, PipelineSortKey } from '@/components/leads/PipelineSortMenu';
import { calculateLeadScore } from '@/lib/leadScore';
import { MessageTemplatesModal } from '@/components/modals/MessageTemplatesModal';
import { BulkWhatsAppModal } from '@/components/modals/BulkWhatsAppModal';
import { BulkDiscardModal } from '@/components/modals/BulkDiscardModal';


interface PipelineViewProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  getLeadStatus: (lead: Lead) => 'late' | 'today' | 'ontime' | 'neutral';
  updateLead: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
  addHistory: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
  msgTemplate: string;
  onCreateLead?: () => void;
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

const STAGE_STRIP: Record<LeadStage, string> = {
  prospeccao: 'bg-stage-prospeccao',
  interesse: 'bg-stage-interesse',
  reuniao: 'bg-stage-reuniao',
  proposta: 'bg-stage-proposta',
  venda: 'bg-stage-venda',
  congelados: 'bg-stage-congelados',
  perdidos: 'bg-stage-perdidos',
};




export function PipelineView({ 
  leads, 
  onOpenLead, 
  getLeadStatus, 
  updateLead, 
  addHistory,
  msgTemplate 
}: PipelineViewProps) {
  const { profile } = useAuth();
  const { celebrateMeeting, celebrateSale } = useCelebration();
  const [selectMode, setSelectMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sortKey, setSortKey] = useState<PipelineSortKey>('recent');
  const [templatesLead, setTemplatesLead] = useState<Lead | null>(null);
  const [manageTemplates, setManageTemplates] = useState(false);
  const [bulkWhats, setBulkWhats] = useState(false);
  const [bulkDiscard, setBulkDiscard] = useState(false);
  const { selectedIds, toggleSelect, clearSelection, deleteSelected, deleting, hasSelection, selectionCount } = useBulkDelete();

  const selectedLeads = leads.filter(l => selectedIds.has(l.id));


  
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = async (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    if (selectMode) return;
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;
    
    const lead = leads.find(l => l.id === leadId);
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
      const options = ['Preço', 'Sem Interesse', 'Já possui sistema', 'Não Responde', 'Pequeno', 'Fechou com outra empresa', 'Deixou pro futuro', 'Private Label', 'Número inexistente', 'Teste do Marketing', 'Tentativas excedidas', 'Só visualiza (não interage)', 'Outro'];
      const reason = prompt(`Motivo da perda?\n\nOpções:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nDigite o número ou o motivo:`) || 'Não Informado';
      const numChoice = parseInt(reason);
      updates.loss_reason = (numChoice >= 1 && numChoice <= options.length) ? options[numChoice - 1] : reason;
    }
    
    await updateLead(leadId, updates);
  };

  const sendWhatsApp = async (lead: Lead, msg: string = msgTemplate) => {
    if (!lead.whatsapp) {
      alert("Sem WhatsApp cadastrado.");
      return;
    }
    
    let finalMsg = msg
      .replace("{nome}", lead.name || "")
      .replace("{empresa}", lead.company || "")
      .replace("{tipo}", lead.confection_type || "");
    
    if (profile?.signature) {
      finalMsg += `\n\n${profile.signature}`;
    }
    
    const phone = cleanPhoneNumber(lead.whatsapp);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(finalMsg)}`, '_blank');
    await addHistory(lead.id, 'whatsapp', `Enviou: "${finalMsg}"`);
  };

  const totalPipelineValue = leads.reduce((acc, curr) => acc + (curr.value || 0), 0);

  const handleToggleSelectMode = () => {
    if (selectMode) clearSelection();
    setSelectMode(!selectMode);
  };

  const handleSelectAllInColumn = (columnLeads: Lead[]) => {
    const allIds = columnLeads.map(l => l.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      allIds.forEach(id => { if (selectedIds.has(id)) toggleSelect(id); });
    } else {
      allIds.forEach(id => { if (!selectedIds.has(id)) toggleSelect(id); });
    }
  };

  const negotiations = leads.filter((l) => ['interesse', 'reuniao', 'proposta'].includes(l.stage)).length;
  const todayStr = new Date().toDateString();
  const meetingsToday = leads.filter(
    (l) => l.meeting_date && new Date(l.meeting_date).toDateString() === todayStr,
  ).length;
  const closedWon = leads.filter((l) => l.stage === 'venda').length;
  const closedLost = leads.filter((l) => ['perdidos'].includes(l.stage)).length;
  const conversionBase = closedWon + closedLost;
  const conversionRate = conversionBase > 0 ? (closedWon / conversionBase) * 100 : null;

  const kpis = [
    {
      label: 'Oportunidades',
      value: formatCurrency(totalPipelineValue),
      icon: DollarSign,
      tone: 'text-success bg-success/10',
    },
    { label: 'Negociações', value: String(negotiations), icon: TrendingUp, tone: 'text-info bg-info/10' },
    { label: 'Reuniões hoje', value: String(meetingsToday), icon: CalendarClock, tone: 'text-stage-reuniao bg-stage-reuniao/10' },
    {
      label: 'Taxa de conversão',
      value: conversionRate === null ? '—' : `${conversionRate.toFixed(0)}%`,
      icon: Target,
      tone: 'text-primary bg-primary/10',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[14px] bg-card border border-border p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.03)] transition-colors hover:border-primary/30"
          >
            <div className="flex items-center gap-2.5">
              <span className={`h-8 w-8 rounded-full grid place-items-center ${kpi.tone}`}>
                <kpi.icon size={15} />
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="mt-2.5 text-[23px] font-semibold tracking-tight text-foreground tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex items-center flex-wrap gap-2">
          {onCreateLead && (
            <Button size="sm" onClick={onCreateLead} className="gap-1.5 h-9 text-[13px] rounded-[10px]">
              <Plus size={14} /> Nova oportunidade
            </Button>
          )}
          <Button
            variant={selectMode ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleSelectMode}
            className="gap-1.5 h-9 text-[13px] rounded-[10px]"
          >
            {selectMode ? <XCircle size={14} /> : <CheckSquare size={14} />}
            {selectMode ? 'Cancelar' : 'Selecionar'}
          </Button>
          {selectMode && hasSelection && (
            <>
              <Button
                size="sm"
                onClick={() => setBulkWhats(true)}
                className="gap-1.5 h-9 text-[13px] rounded-[10px] bg-success text-success-foreground hover:bg-success/90"
              >
                <MessageCircle size={14} />
                Mensagem {selectionCount}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulkDiscard(true)} className="gap-1.5 h-9 text-[13px] rounded-[10px]">
                <Ban size={14} />
                Descartar {selectionCount}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={deleting}
                className="gap-1.5 h-9 text-[13px] rounded-[10px]"
              >
                <Trash2 size={14} />
                Excluir {selectionCount}
              </Button>
            </>
          )}

          <PipelineSortMenu value={sortKey} onChange={setSortKey} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManageTemplates(true)}
            className="gap-1.5 h-9 text-[13px] rounded-[10px]"
            title="Gerenciar templates de WhatsApp"
          >
            <Sparkles size={14} className="text-primary" />
            Templates
          </Button>
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-330px)] min-h-[420px] scrollbar-thin">
        {COLUMNS.map(col => {
          const rawColLeads = leads.filter(l => l.stage === col.id);
          const colLeads = sortLeads(rawColLeads, sortKey, calculateLeadScore);
          const colValue = colLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);
          const allColSelected = colLeads.length > 0 && colLeads.every(l => selectedIds.has(l.id));
          const stageStripClass = STAGE_STRIP[col.id];
          
          return (
            <div
              key={col.id}
              className="min-w-[304px] w-[304px] bg-card rounded-[14px] border border-border flex flex-col flex-shrink-0 overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.03)]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Colored top strip */}
              <div className={`h-[3px] w-full ${stageStripClass}`} />
              {/* Column header */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectMode && colLeads.length > 0 && (
                      <Checkbox
                        checked={allColSelected}
                        onCheckedChange={() => handleSelectAllInColumn(colLeads)}
                      />
                    )}
                    <span className="font-semibold text-foreground text-[16px] tracking-tight truncate">{col.title}</span>
                  </div>
                  <span className="bg-muted text-muted-foreground min-w-[26px] h-6 px-2 rounded-md text-[12px] font-semibold flex items-center justify-center tabular-nums">
                    {colLeads.length}
                  </span>
                </div>
                {colValue > 0 && (
                  <div className="text-[12px] text-muted-foreground mt-1 tabular-nums">
                    {formatCurrency(colValue)}
                  </div>
                )}
              </div>

              {/* Cards */}
              <div className="px-3 pb-3 flex-1 overflow-y-auto space-y-2.5 min-h-[200px] scrollbar-thin">
                {onCreateLead && col.id === COLUMNS[0].id && (
                  <button
                    onClick={onCreateLead}
                    className="w-full flex items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-border bg-muted/30 py-2.5 text-[12.5px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors duration-150"
                  >
                    <Plus size={14} /> Adicionar oportunidade
                  </button>
                )}
                {colLeads.map(lead => (
                  <div key={lead.id} className="flex items-start gap-1">
                    {selectMode && (
                      <div className="pt-3 pl-1 flex-shrink-0">
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <LeadCard
                        lead={lead}
                        onClick={() => !selectMode && onOpenLead(lead)}
                        status={getLeadStatus(lead)}
                        onQuickWhatsApp={(e) => {
                          e.stopPropagation();
                          if (!selectMode) sendWhatsApp(lead);
                        }}
                        onOpenTemplates={(l) => !selectMode && setTemplatesLead(l)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>


      {bulkWhats && (
        <BulkWhatsAppModal
          leads={selectedLeads}
          addHistory={addHistory}
          onClose={() => setBulkWhats(false)}
        />
      )}
      {bulkDiscard && (
        <BulkDiscardModal
          leads={selectedLeads}
          updateLead={updateLead}
          addHistory={addHistory}
          onDone={clearSelection}
          onClose={() => setBulkDiscard(false)}
        />
      )}
      {templatesLead && (
        <MessageTemplatesModal
          mode="pick"
          lead={templatesLead}
          addHistory={addHistory}
          onClose={() => setTemplatesLead(null)}
        />
      )}
      {manageTemplates && (
        <MessageTemplatesModal
          mode="manage"
          onClose={() => setManageTemplates(false)}
        />
      )}
    </div>
  );
}
