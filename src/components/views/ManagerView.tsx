import { useState } from 'react';
import { ApprovalManager } from '@/components/ApprovalManager';
import { Lead, LeadStage, LeadHistory, LeadSource, STAGE_LABELS } from '@/types/lead';
import { ClientInfoForm } from '@/components/manager/ClientInfoForm';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, TrendingUp, AlertTriangle, Target, DollarSign, Clock,
  RefreshCw, UserPlus, UserMinus, MessageSquare, Calendar, Phone,
  Mail, ExternalLink, ChevronDown, ChevronUp, Sparkles, LayoutGrid, BarChart3, Trash2, FileText, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useManagerData } from '@/hooks/useManagerData';
import { ManagerPipelineView } from './ManagerPipelineView';
import { ProposalModal } from '@/components/modals/ProposalModal';
import { ManualQuoteModal } from '@/components/modals/ManualQuoteModal';
import { ProductsManager } from '@/components/manager/ProductsManager';
import { Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ManagerViewProps {
  leads: Lead[];
  getLeadStatus: (lead: Lead) => 'late' | 'today' | 'ontime' | 'neutral';
  percentGoal: number;
  onCreateLead?: (source: LeadSource) => void;
  onOpenLead?: (lead: Lead) => void;
  updateLead?: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
  addHistory?: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
}

type ManagerSubView = 'pipeline' | 'metrics' | 'approvals' | 'fichas' | 'produtos';

export function ManagerView({ leads, getLeadStatus: externalGetLeadStatus, percentGoal, onCreateLead, onOpenLead, updateLead: externalUpdateLead, addHistory: externalAddHistory }: ManagerViewProps) {
  const { user, profile } = useAuth();
  const {
    sdrs,
    allLeads,
    loading,
    syncing,
    addSDRById,
    removeSDR,
    updateLeadManagerNotes,
    updateLeadResponsible,
    deleteLead,
    syncActiveCampaign,
    refreshData,
    getLeadStatus,
  } = useManagerData();

  const [newSdrId, setNewSdrId] = useState('');
  const [expandedSDR, setExpandedSDR] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [proposalLead, setProposalLead] = useState<Lead | null>(null);
  
  const [subView, setSubView] = useState<ManagerSubView>('pipeline');
  const [selectedSDRFilter, setSelectedSDRFilter] = useState<string | null>(null);
  const [managerSearch, setManagerSearch] = useState('');
  const [fichaLead, setFichaLead] = useState<Lead | null>(null);
  const [fichaSearch, setFichaSearch] = useState('');
  const [quotesRefreshKey, setQuotesRefreshKey] = useState(0);
  const [manualQuoteOpen, setManualQuoteOpen] = useState(false);
  const [manualQuotePrefillLead, setManualQuotePrefillLead] = useState<Lead | null>(null);

  // Use allLeads from manager data if available, otherwise use passed leads
  const displayLeads = allLeads.length > 0 ? allLeads : leads;
  const statusFn = allLeads.length > 0 ? getLeadStatus : externalGetLeadStatus;

  const totalLeads = displayLeads.length;
  const lateLeads = displayLeads.filter(l => statusFn(l) === 'late').length;
  const wonLeads = displayLeads.filter(l => l.stage === 'venda').length;
  const lostLeads = displayLeads.filter(l => l.stage === 'perdidos').length;
  const meetingLeads = displayLeads.filter(l => l.stage === 'reuniao').length;
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';
  
  const pipelineByStage: Record<LeadStage, number> = {
    prospeccao: displayLeads.filter(l => l.stage === 'prospeccao').length,
    interesse: displayLeads.filter(l => l.stage === 'interesse').length,
    reuniao: displayLeads.filter(l => l.stage === 'reuniao').length,
    proposta: displayLeads.filter(l => l.stage === 'proposta').length,
    venda: displayLeads.filter(l => l.stage === 'venda').length,
    congelados: displayLeads.filter(l => l.stage === 'congelados').length,
    perdidos: displayLeads.filter(l => l.stage === 'perdidos').length,
  };

  const totalImplementation = displayLeads
    .filter(l => l.stage === 'venda')
    .reduce((acc, l) => acc + (l.implementation_value || 0), 0);
  const totalMonthly = displayLeads
    .filter(l => l.stage === 'venda')
    .reduce((acc, l) => acc + (l.monthly_value || 0), 0);

  const handleAddSDR = () => {
    if (newSdrId.trim()) {
      addSDRById(newSdrId.trim());
      setNewSdrId('');
    }
  };

  const handleSaveManagerNotes = () => {
    if (selectedLead) {
      updateLeadManagerNotes(selectedLead.id, managerNotes);
    }
  };

  const openLeadNotes = (lead: Lead) => {
    setSelectedLead(lead);
    setManagerNotes(lead.manager_notes || '');
  };

  const stageColors: Record<LeadStage, string> = {
    prospeccao: 'bg-stage-prospeccao',
    interesse: 'bg-stage-interesse',
    reuniao: 'bg-stage-reuniao',
    proposta: 'bg-stage-proposta',
    venda: 'bg-stage-venda',
    congelados: 'bg-stage-congelados',
    perdidos: 'bg-stage-perdidos',
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-card p-4 rounded-xl border border-border">
        <div className="flex gap-2 items-center">
          {/* View Toggle */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant={subView === 'pipeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubView('pipeline')}
              className="gap-2"
            >
              <LayoutGrid size={14} /> Pipeline
            </Button>
            <Button
              variant={subView === 'metrics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubView('metrics')}
              className="gap-2"
            >
              <BarChart3 size={14} /> Métricas
            </Button>
            <Button
              variant={subView === 'approvals' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubView('approvals')}
              className="gap-2"
            >
              <Users size={14} /> Aprovações
            </Button>
            <Button
              variant={subView === 'fichas' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubView('fichas')}
              className="gap-2"
            >
              <FileText size={14} /> Fichas
            </Button>
            <Button
              variant={subView === 'produtos' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubView('produtos')}
              className="gap-2"
            >
              <Package size={14} /> Produtos
            </Button>
          </div>

          {/* SDR Filter + Search */}
          {subView === 'pipeline' && (
            <>
              <Select
                value={selectedSDRFilter || 'all'}
                onValueChange={(value) => setSelectedSDRFilter(value === 'all' ? null : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por SDR" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os SDRs</SelectItem>
                  {sdrs.map(sdr => (
                    <SelectItem key={sdr.user_id} value={sdr.user_id}>
                      {sdr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-muted-foreground/60" size={14} />
                <Input
                  type="text"
                  placeholder="Buscar lead, número..."
                  className="pl-8 h-9 w-[200px] bg-muted/50 border-border/50 text-sm"
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                />
              </div>
            </>
          )}

          <Button 
            onClick={() => syncActiveCampaign()} 
            disabled={syncing}
            className="gap-2"
            variant="outline"
          >
            <Sparkles size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar AC'}
          </Button>
          <Button onClick={refreshData} variant="ghost" size="icon" title="Atualizar dados">
            <RefreshCw size={16} />
          </Button>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Tempo Real
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          {onCreateLead && (
            <>
              <Button
                onClick={() => onCreateLead('prospeccao_ativa')}
                variant="outline"
                className="gap-2"
              >
                <UserPlus size={16} /> Novo Lead (Prospecção)
              </Button>
              <Button
                onClick={() => onCreateLead('indicacao')}
                variant="outline"
                className="gap-2"
              >
                <UserPlus size={16} /> Novo Lead (Indicação)
              </Button>
            </>
          )}

          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={16} /> Adicionar SDR
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar SDR à Equipe</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Peça ao SDR para copiar seu ID de usuário nas configurações do perfil e cole aqui.
                </p>
                <Input
                  placeholder="ID do usuário do SDR"
                  value={newSdrId}
                  onChange={(e) => setNewSdrId(e.target.value)}
                />
                <Button onClick={handleAddSDR} className="w-full">
                  Adicionar SDR
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pipeline View */}
      {subView === 'pipeline' && (
        loading ? (
          <div className="text-center text-muted-foreground py-12">Carregando pipeline...</div>
        ) : (
          <ManagerPipelineView
            leads={displayLeads}
            sdrs={sdrs}
            getLeadStatus={statusFn}
            onLeadClick={(lead) => {
              if (onOpenLead) {
                onOpenLead(lead);
              } else {
                openLeadNotes(lead);
              }
            }}
            selectedSDR={selectedSDRFilter}
            updateLead={externalUpdateLead}
            addHistory={externalAddHistory}
            searchQuery={managerSearch}
          />
        )
      )}

      {/* Metrics View */}
      {subView === 'metrics' && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard
              icon={Users}
              label="Total de Leads"
              value={totalLeads.toString()}
              color="text-info"
              bgColor="bg-info/10"
            />
            <MetricCard
              icon={Calendar}
              label="Em Reunião"
              value={meetingLeads.toString()}
              color="text-primary"
              bgColor="bg-primary/10"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Atrasados"
              value={lateLeads.toString()}
              color="text-destructive"
              bgColor="bg-destructive/10"
            />
            <MetricCard
              icon={TrendingUp}
              label="Conversão"
              value={`${conversionRate}%`}
              color="text-success"
              bgColor="bg-success/10"
            />
            <MetricCard
              icon={Target}
              label="Meta"
              value={`${percentGoal.toFixed(1)}%`}
              color="text-warning"
              bgColor="bg-warning/10"
            />
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SDR List */}
        <div className="lg:col-span-1 bg-card rounded-xl border border-border shadow-sm p-4">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Users size={18} /> Equipe de SDRs ({sdrs.length})
          </h3>
          
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : sdrs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhum SDR vinculado. Adicione SDRs para acompanhar.
            </div>
          ) : (
            <div className="space-y-2">
              {sdrs.map(sdr => {
                const sdrWon = sdr.leads.filter(l => l.stage === 'venda').length;
                const sdrMeetings = sdr.leads.filter(l => l.stage === 'reuniao').length;
                const isExpanded = expandedSDR === sdr.user_id;

                return (
                  <Collapsible 
                    key={sdr.user_id}
                    open={isExpanded}
                    onOpenChange={() => setExpandedSDR(isExpanded ? null : sdr.user_id)}
                  >
                    <div className="bg-muted rounded-lg p-3">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {sdr.avatar ? (
                              <img src={sdr.avatar} alt={sdr.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Users size={20} className="text-primary" />
                              </div>
                            )}
                            <div className="text-left">
                              <p className="font-medium text-foreground">{sdr.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {sdr.leads.length} leads • {sdrMeetings} reuniões • {sdrWon} vendas
                              </p>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="mt-3 pt-3 border-t border-border">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {sdr.leads.slice(0, 5).map(lead => (
                            <div 
                              key={lead.id} 
                              className={`flex items-center justify-between p-2 rounded text-sm cursor-pointer hover:bg-background/50 ${
                                lead.is_new ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-background/30'
                              }`}
                              onClick={() => openLeadNotes(lead)}
                            >
                              <div className="flex items-center gap-2">
                                {lead.is_new && <Sparkles size={12} className="text-purple-500" />}
                                <span className="truncate max-w-[120px]">{lead.name}</span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded ${stageColors[lead.stage]} text-white`}>
                                {STAGE_LABELS[lead.stage]}
                              </span>
                            </div>
                          ))}
                          {sdr.leads.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{sdr.leads.length - 5} mais leads
                            </p>
                          )}
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full mt-3"
                          onClick={() => removeSDR(sdr.user_id)}
                        >
                          <UserMinus size={14} className="mr-2" /> Remover SDR
                        </Button>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>

        {/* Funnel */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock size={18} /> Funil de Vendas
          </h3>
          <div className="space-y-3">
            {(Object.entries(pipelineByStage) as [LeadStage, number][]).map(([stage, count]) => {
              const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              
              return (
                <div key={stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{STAGE_LABELS[stage]}</span>
                    <span className="font-bold text-foreground">{count}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`${stageColors[stage]} h-2 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Values */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <DollarSign size={18} /> Valores
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
              <div>
                <p className="text-sm text-primary">Implantação</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalImplementation)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-4 bg-success/10 rounded-lg">
              <div>
                <p className="text-sm text-success">Mensalidade (MRR)</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalMonthly)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-success">{wonLeads}</p>
                <p className="text-xs text-muted-foreground">Vendas</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-destructive">{lostLeads}</p>
                <p className="text-xs text-muted-foreground">Perdidos</p>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Lead Notes Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare size={18} />
              Notas do Gestor - {selectedLead?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone size={14} />
                  {selectedLead.whatsapp || 'Sem telefone'}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail size={14} />
                  {selectedLead.email || 'Sem email'}
                </div>
              </div>

              {selectedLead.meeting_date && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium text-primary flex items-center gap-2">
                    <Calendar size={14} />
                    Reunião: {new Date(selectedLead.meeting_date).toLocaleString('pt-BR')}
                  </p>
                  {selectedLead.meeting_link && (
                    <a 
                      href={selectedLead.meeting_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 mt-1"
                    >
                      <ExternalLink size={12} /> Acessar reunião
                    </a>
                  )}
                </div>
              )}

              {selectedLead.meeting_pain && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Dor identificada:</p>
                  <p className="text-sm">{selectedLead.meeting_pain}</p>
                </div>
              )}

              {selectedLead.meeting_needs && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Necessidades:</p>
                  <p className="text-sm">{selectedLead.meeting_needs}</p>
                </div>
              )}

              {/* Responsible person is now managed by the SDR in the LeadModal */}

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Notas para retorno (visível apenas para você):
                </label>
                <Textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Adicione notas sobre o que foi combinado, próximos passos, etc."
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveManagerNotes} className="flex-1">
                  Salvar Notas
                </Button>
                {selectedLead?.stage === 'proposta' && (
                  <Button
                    variant="outline"
                    className="gap-2 border-primary text-primary"
                    onClick={() => {
                      setProposalLead(selectedLead);
                    }}
                  >
                    <FileText size={16} /> Gerar Proposta
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={async () => {
                    if (selectedLead && confirm(`Tem certeza que deseja excluir o lead "${selectedLead.name}"?`)) {
                      const success = await deleteLead(selectedLead.id);
                      if (success) setSelectedLead(null);
                    }
                  }}
                  title="Excluir lead"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Approvals View */}
      {subView === 'approvals' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Gerenciar Aprovações de Usuários</h2>
          <ApprovalManager />
        </div>
      )}

      {/* Fichas View */}
      {subView === 'fichas' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
            <Search size={16} className="text-muted-foreground" />
            <Input
              placeholder="Buscar cliente por nome, telefone ou empresa..."
              value={fichaSearch}
              onChange={(e) => setFichaSearch(e.target.value)}
              className="max-w-md"
            />
            <div className="flex-1" />
            <Button
              onClick={() => {
                setManualQuotePrefillLead(null);
                setManualQuoteOpen(true);
              }}
              className="gap-2"
            >
              <FileText size={16} /> Novo Orçamento Manual
            </Button>
          </div>

          {fichaLead ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setFichaLead(null)} className="gap-2">
                  ← Voltar à lista
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManualQuotePrefillLead(fichaLead);
                    setManualQuoteOpen(true);
                  }}
                  className="gap-2"
                >
                  <FileText size={14} /> Orçamento manual para este cliente
                </Button>
              </div>
              <ClientInfoForm
                lead={fichaLead}
                onSave={async (leadId, updates) => {
                  if (externalUpdateLead) {
                    return await externalUpdateLead(leadId, updates);
                  }
                  return false;
                }}
                allLeads={displayLeads}
                quotesRefreshKey={quotesRefreshKey}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayLeads
                .filter(l => {
                  if (!fichaSearch) return true;
                  const q = fichaSearch.toLowerCase();
                  return (
                    l.name.toLowerCase().includes(q) ||
                    (l.company || '').toLowerCase().includes(q) ||
                    (l.whatsapp || '').includes(q) ||
                    (l.email || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 30)
                .map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => setFichaLead(lead)}
                    className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <p className="font-semibold text-foreground">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.company || 'Sem empresa'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{lead.whatsapp || 'Sem telefone'}</p>
                    <span className="text-[10px] mt-2 inline-block px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {STAGE_LABELS[lead.stage]}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Produtos View */}
      {subView === 'produtos' && <ProductsManager />}

      {/* Proposal Modal */}
      <ProposalModal
        lead={proposalLead}
        open={!!proposalLead}
        onClose={() => setProposalLead(null)}
      />

      {/* Manual Quote Modal */}
      <ManualQuoteModal
        open={manualQuoteOpen}
        onClose={() => {
          setManualQuoteOpen(false);
          setManualQuotePrefillLead(null);
        }}
        leads={displayLeads}
        prefillLead={manualQuotePrefillLead}
        onQuoteSaved={() => {
          refreshData();
          setQuotesRefreshKey((k) => k + 1);
          // Se o usuário está com a ficha aberta, mantém na ficha para baixar o PDF.
          // Caso contrário, vai para o pipeline para ver o card criado.
          if (!fichaLead) {
            setSubView('pipeline');
          }
        }}
      />
    </div>
  );
}


interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}

function MetricCard({ icon: Icon, label, value, color, bgColor }: MetricCardProps) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
      <div className={`${bgColor} w-10 h-10 rounded-full flex items-center justify-center mb-3`}>
        <Icon className={color} size={20} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
