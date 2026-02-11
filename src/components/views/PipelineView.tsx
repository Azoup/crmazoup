import { useState } from 'react';
import { Lead, LeadStage, LeadHistory, MeetingStatus, STAGE_COLORS } from '@/types/lead';
import { LeadCard } from '@/components/leads/LeadCard';
import { formatCurrency, cleanPhoneNumber } from '@/lib/utils';
import { DollarSign, Trash2, CheckSquare, Square, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCelebration } from '@/hooks/useCelebration';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

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
  const { selectedIds, toggleSelect, selectAll, clearSelection, deleteSelected, deleting, hasSelection, selectionCount } = useBulkDelete();
  
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = async (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    if (selectMode) return; // disable drag in select mode
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
      const options = ['Preço', 'Sem Interesse', 'Já possui sistema', 'Não Responde', 'Pequeno', 'Fechou com outra empresa', 'Deixou pro futuro', 'Outro'];
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
    if (selectMode) {
      clearSelection();
    }
    setSelectMode(!selectMode);
  };

  const handleSelectAllInColumn = (columnLeads: Lead[]) => {
    const allIds = columnLeads.map(l => l.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      // Deselect all in this column
      allIds.forEach(id => {
        if (selectedIds.has(id)) toggleSelect(id);
      });
    } else {
      // Select all in this column
      allIds.forEach(id => {
        if (!selectedIds.has(id)) toggleSelect(id);
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="flex items-center gap-2">
          <Button
            variant={selectMode ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleSelectMode}
            className="gap-2"
          >
            {selectMode ? <XCircle size={14} /> : <CheckSquare size={14} />}
            {selectMode ? 'Cancelar Seleção' : 'Selecionar'}
          </Button>
          {selectMode && hasSelection && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelected}
              disabled={deleting}
              className="gap-2"
            >
              <Trash2 size={14} />
              Excluir {selectionCount} lead(s)
            </Button>
          )}
        </div>
        <div className="bg-card px-3 py-1 rounded-full border shadow-sm text-xs font-bold text-muted-foreground flex items-center gap-2">
          <DollarSign size={12} className="text-success" /> 
          Total em Oportunidades: 
          <span className="text-success text-sm">{formatCurrency(totalPipelineValue)}</span>
        </div>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)] scrollbar-thin">
        {COLUMNS.map(col => {
          const colLeads = leads
            .filter(l => l.stage === col.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const colValue = colLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);
          const allColSelected = colLeads.length > 0 && colLeads.every(l => selectedIds.has(l.id));
          
          return (
            <div
              key={col.id}
              className="min-w-[280px] w-[280px] bg-card rounded-xl shadow-sm border border-border flex flex-col flex-shrink-0 transition-colors"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className={`p-3 border-b-4 ${STAGE_COLORS[col.id]} bg-muted rounded-t-xl`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    {selectMode && colLeads.length > 0 && (
                      <Checkbox
                        checked={allColSelected}
                        onCheckedChange={() => handleSelectAllInColumn(colLeads)}
                      />
                    )}
                    <span className="font-bold text-foreground text-sm">{col.title}</span>
                  </div>
                  <span className="bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full text-xs font-bold">
                    {colLeads.length}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <DollarSign size={10} /> {formatCurrency(colValue)}
                </div>
              </div>
              
              <div className="p-2 flex-1 overflow-y-auto bg-muted/50 space-y-2 min-h-[200px] scrollbar-thin">
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
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}