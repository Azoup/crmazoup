import { Lead } from '@/types/lead';
import { formatCurrency } from '@/lib/utils';
import { Users, TrendingUp, AlertTriangle, Target, DollarSign, Clock } from 'lucide-react';

interface ManagerViewProps {
  leads: Lead[];
  getLeadStatus: (lead: Lead) => 'late' | 'today' | 'ontime' | 'neutral';
  percentGoal: number;
}

export function ManagerView({ leads, getLeadStatus, percentGoal }: ManagerViewProps) {
  const totalLeads = leads.length;
  const lateLeads = leads.filter(l => getLeadStatus(l) === 'late').length;
  const wonLeads = leads.filter(l => l.stage === 'venda').length;
  const lostLeads = leads.filter(l => l.stage === 'perdidos').length;
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';
  
  const pipelineByStage = {
    prospeccao: leads.filter(l => l.stage === 'prospeccao').length,
    interesse: leads.filter(l => l.stage === 'interesse').length,
    reuniao: leads.filter(l => l.stage === 'reuniao').length,
    venda: leads.filter(l => l.stage === 'venda').length,
    congelados: leads.filter(l => l.stage === 'congelados').length,
    perdidos: leads.filter(l => l.stage === 'perdidos').length,
  };

  const totalValue = leads.reduce((acc, l) => acc + (l.value || 0), 0);
  const wonValue = leads.filter(l => l.stage === 'venda').reduce((acc, l) => acc + (l.value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Total de Leads"
          value={totalLeads.toString()}
          color="text-info"
          bgColor="bg-info/10"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Leads Atrasados"
          value={lateLeads.toString()}
          color="text-destructive"
          bgColor="bg-destructive/10"
        />
        <MetricCard
          icon={TrendingUp}
          label="Taxa Conversão"
          value={`${conversionRate}%`}
          color="text-success"
          bgColor="bg-success/10"
        />
        <MetricCard
          icon={Target}
          label="Meta Atingida"
          value={`${percentGoal.toFixed(1)}%`}
          color="text-primary"
          bgColor="bg-primary/10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock size={18} /> Funil de Vendas
          </h3>
          <div className="space-y-3">
            {Object.entries(pipelineByStage).map(([stage, count]) => {
              const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              const stageLabels: Record<string, string> = {
                prospeccao: 'Prospecção',
                interesse: 'Interesse',
                reuniao: 'Reunião',
                venda: 'Venda',
                congelados: 'Congelados',
                perdidos: 'Perdidos',
              };
              const stageColors: Record<string, string> = {
                prospeccao: 'bg-stage-prospeccao',
                interesse: 'bg-stage-interesse',
                reuniao: 'bg-stage-reuniao',
                venda: 'bg-stage-venda',
                congelados: 'bg-stage-congelados',
                perdidos: 'bg-stage-perdidos',
              };
              
              return (
                <div key={stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{stageLabels[stage]}</span>
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

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <DollarSign size={18} /> Valores
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total em Pipeline</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-4 bg-success/10 rounded-lg">
              <div>
                <p className="text-sm text-success">Valor Fechado</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(wonValue)}</p>
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