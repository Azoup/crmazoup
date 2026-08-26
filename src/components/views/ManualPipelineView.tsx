import { useState } from 'react';
import { Lead, LeadStage, LeadHistory, LeadSource, STAGE_COLORS } from '@/types/lead';
import { LeadCard } from '@/components/leads/LeadCard';
import { formatCurrency, cleanPhoneNumber } from '@/lib/utils';
import { DollarSign, Trash2, CheckSquare, XCircle, Plus, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCelebration } from '@/hooks/useCelebration';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ImportLeadsModal } from '@/components/modals/ImportLeadsModal';


interface ManualPipelineViewProps {
  leads: Lead[];
  allLeads: Lead[];
  source: LeadSource;
  sourceLabel: string;
  onOpenLead: (lead: Lead) => void;
  onCreateLead: (source: LeadSource) => void;
  getLeadStatus: (lead: Lead) => 'late' | 'today' | 'ontime' | 'neutral';
  updateLead: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
  addHistory: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
  addLead: (leadData: Partial<Lead>) => Promise<Lead | null>;
  deleteLead: (leadId: string) => Promise<void>;
  msgTemplate: string;
  onUpdateTemplate: (template: string) => void;
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

export function ManualPipelineView({
  leads,
  allLeads,
  source,
  sourceLabel,
  onOpenLead,
  onCreateLead,
  getLeadStatus,
  updateLead,
  addHistory,
  addLead,
  deleteLead,
  msgTemplate,
  onUpdateTemplate,
}: ManualPipelineViewProps) {
  const { profile } = useAuth();
  const { celebrateMeeting, celebrateSale } = useCelebration();
  const [selectMode, setSelectMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { selectedIds, toggleSelect, clearSelection, deleteSelected, deleting, hasSelection, selectionCount } = useBulkDelete();

  // Filter leads by source
  const sourceLeads = leads.filter(l => l.lead_source === source);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    if (selectMode) return;
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    const lead = sourceLeads.find(l => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    if (targetStage === 'reuniao' && lead.stage !== 'reuniao') celebrateMeeting();

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
    if (!lead.whatsapp) { alert("Sem WhatsApp cadastrado."); return; }
    let finalMsg = msg.replace("{nome}", lead.name || "").replace("{empresa}", lead.company || "").replace("{tipo}", lead.confection_type || "");
    if (profile?.signature) finalMsg += `\n\n${profile.signature}`;
    const phone = cleanPhoneNumber(lead.whatsapp);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(finalMsg)}`, '_blank');
    await addHistory(lead.id, 'whatsapp', `Enviou: "${finalMsg}"`);
  };

  const totalPipelineValue = sourceLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);

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
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onCreateLead(source)}
            size="sm"
            className="gap-1.5 h-8 text-xs"
          >
            <Plus size={13} />
            Novo Lead ({sourceLabel})
          </Button>
          <Button
            variant={selectMode ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleSelectMode}
            className="gap-1.5 h-8 text-xs"
          >
            {selectMode ? <XCircle size={13} /> : <CheckSquare size={13} />}
            {selectMode ? 'Cancelar' : 'Selecionar'}
          </Button>
          {source === 'prospeccao_ativa' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="gap-1.5 h-8 text-xs"
              title="Importar leads de planilha (.xlsx) — entram como frio"
            >
              <Upload size={13} />
              Importar planilha
            </Button>
          )}
          {selectMode && hasSelection && (
            <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={deleting} className="gap-1.5 h-8 text-xs">
              <Trash2 size={13} /> Excluir {selectionCount}
            </Button>
          )}
        </div>

        <div className="bg-card px-3 py-1.5 rounded-lg border border-border/50 shadow-sm text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <DollarSign size={12} className="text-success" />
          <span className="hidden sm:inline">Oportunidades:</span>
          <span className="text-success font-bold">{formatCurrency(totalPipelineValue)}</span>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)] scrollbar-thin">
        {COLUMNS.map(col => {
          const colLeads = sourceLeads
            .filter(l => l.stage === col.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const colValue = colLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);
          const allColSelected = colLeads.length > 0 && colLeads.every(l => selectedIds.has(l.id));

          return (
            <div
              key={col.id}
              className="min-w-[300px] w-[300px] bg-card/60 rounded-2xl border border-border/40 flex flex-col flex-shrink-0 overflow-hidden shadow-sm"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className={`px-4 py-3 border-b-2 ${STAGE_COLORS[col.id]} bg-card`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {selectMode && colLeads.length > 0 && (
                      <Checkbox checked={allColSelected} onCheckedChange={() => handleSelectAllInColumn(colLeads)} />
                    )}
                    <span className="font-bold text-foreground text-sm">{col.title}</span>
                  </div>
                  <span className="bg-foreground/10 text-foreground/70 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center">
                    {colLeads.length}
                  </span>
                </div>
                {colValue > 0 && (
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1.5">
                    <DollarSign size={11} /> {formatCurrency(colValue)}
                  </div>
                )}
              </div>

              <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px] scrollbar-thin">
                {colLeads.map(lead => (
                  <div key={lead.id} className="flex items-start gap-1">
                    {selectMode && (
                      <div className="pt-3 pl-1 flex-shrink-0">
                        <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
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

      {importOpen && (
        <ImportLeadsModal
          onClose={() => setImportOpen(false)}
          onImported={() => window.dispatchEvent(new Event('leads:refresh'))}
          stage="prospeccao"
          temperature="frio"
          leadSource="prospeccao_ativa"
          stageLabel="Prospecção Ativa"
        />
      )}
    </div>
  );
}

