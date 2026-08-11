import { useState } from 'react';
import { Lead, LeadStage, LeadHistory, MeetingStatus, STAGE_COLORS } from '@/types/lead';
import { LeadCard } from '@/components/leads/LeadCard';
import { formatCurrency, cleanPhoneNumber } from '@/lib/utils';
import { DollarSign, Trash2, CheckSquare, XCircle, Sparkles } from 'lucide-react';
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

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-2">
          <Button
            variant={selectMode ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleSelectMode}
            className="gap-1.5 h-8 text-xs"
          >
            {selectMode ? <XCircle size={13} /> : <CheckSquare size={13} />}
            {selectMode ? 'Cancelar' : 'Selecionar'}
          </Button>
          {selectMode && hasSelection && (
            <>
              <Button
                size="sm"
                onClick={() => setBulkWhats(true)}
                className="gap-1.5 h-8 text-xs bg-success text-success-foreground hover:bg-success/90"
              >
                <MessageCircle size={13} />
                Mensagem {selectionCount}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkDiscard(true)}
                className="gap-1.5 h-8 text-xs"
              >
                <Ban size={13} />
                Descartar {selectionCount}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={deleting}
                className="gap-1.5 h-8 text-xs"
              >
                <Trash2 size={13} />
                Excluir {selectionCount}
              </Button>
            </>
          )}

          <PipelineSortMenu value={sortKey} onChange={setSortKey} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManageTemplates(true)}
            className="gap-1.5 h-8 text-xs hover-scale"
            title="Gerenciar templates de WhatsApp"
          >
            <Sparkles size={13} className="text-primary" />
            Templates
          </Button>
        </div>
        <div className="bg-card px-3 py-1.5 rounded-lg border border-border/50 shadow-sm text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <DollarSign size={12} className="text-success" /> 
          <span className="hidden sm:inline">Oportunidades:</span>
          <span className="text-success font-bold">{formatCurrency(totalPipelineValue)}</span>
        </div>
      </div>
      
      {/* Pipeline columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)] scrollbar-thin">
        {COLUMNS.map(col => {
          const rawColLeads = leads.filter(l => l.stage === col.id);
          const colLeads = sortLeads(rawColLeads, sortKey, calculateLeadScore);
          const colValue = colLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);
          const allColSelected = colLeads.length > 0 && colLeads.every(l => selectedIds.has(l.id));
          const stageStripClass = STAGE_STRIP[col.id];
          
          return (
            <div
              key={col.id}
              className="min-w-[300px] w-[300px] bg-card/80 glass rounded-2xl border border-border/30 flex flex-col flex-shrink-0 overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 animate-fade-in"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Colored top strip */}
              <div className={`h-1.5 w-full ${stageStripClass}`} />
              {/* Column header */}
              <div className={`px-4 py-3 border-b ${STAGE_COLORS[col.id]} bg-card`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {selectMode && colLeads.length > 0 && (
                      <Checkbox
                        checked={allColSelected}
                        onCheckedChange={() => handleSelectAllInColumn(colLeads)}
                      />
                    )}
                    <span className="font-bold text-foreground text-sm">{col.title}</span>
                  </div>
                  <span className="bg-foreground/10 text-foreground/70 min-w-[24px] h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center">
                    {colLeads.length}
                  </span>
                </div>
                {colValue > 0 && (
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1.5">
                    <DollarSign size={11} /> {formatCurrency(colValue)}
                  </div>
                )}
              </div>

              
              {/* Cards */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px] scrollbar-thin">
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
