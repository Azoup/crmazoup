import { Lead } from '@/types/lead';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, Target, TrendingUp, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SalesViewProps {
  totalSold: number;
  totalImplementation: number;
  totalMonthly: number;
  salesGoal: number;
  percentGoal: number;
  leads: Lead[];
  onUpdateGoal: (goal: number) => void;
}

export function SalesView({ totalSold, totalImplementation, totalMonthly, salesGoal, percentGoal, leads, onUpdateGoal }: SalesViewProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState(salesGoal.toString());
  
  const wonLeads = leads.filter(l => l.stage === 'venda');

  const handleSaveGoal = () => {
    const value = Number(newGoal.replace(/\D/g, ''));
    if (value > 0) {
      onUpdateGoal(value);
    }
    setEditingGoal(false);
  };

  return (
    <div className="space-y-6">
      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-success/10 p-3 rounded-full">
              <DollarSign className="text-success" size={24} />
            </div>
            <span className="text-xs bg-success/10 text-success px-2 py-1 rounded font-bold">
              Total Vendido
            </span>
          </div>
          <h3 className="text-3xl font-bold text-foreground">{formatCurrency(totalSold)}</h3>
          <p className="text-sm text-muted-foreground mt-1">Implantação + Mensalidades</p>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Target className="text-primary" size={24} />
            </div>
            {editingGoal ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  className="w-28 h-8 text-sm"
                />
                <Button size="sm" onClick={handleSaveGoal}>Salvar</Button>
              </div>
            ) : (
              <button
                onClick={() => setEditingGoal(true)}
                className="text-xs text-muted-foreground hover:text-primary underline"
              >
                Editar meta
              </button>
            )}
          </div>
          <h3 className="text-3xl font-bold text-foreground">{formatCurrency(salesGoal)}</h3>
          <p className="text-sm text-muted-foreground mt-1">Meta de vendas</p>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-warning/10 p-3 rounded-full">
              <TrendingUp className="text-warning" size={24} />
            </div>
            <span className={`text-xs px-2 py-1 rounded font-bold ${
              percentGoal >= 100 
                ? 'bg-success/10 text-success' 
                : percentGoal >= 50 
                  ? 'bg-warning/10 text-warning' 
                  : 'bg-destructive/10 text-destructive'
            }`}>
              {percentGoal.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-4 mb-2">
            <div 
              className="bg-gradient-to-r from-primary to-success h-4 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, percentGoal)}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">Progresso da meta</p>
        </div>
      </div>

      {/* Implementation vs Monthly breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Implantação</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-bold">
              Único
            </span>
          </div>
          <h3 className="text-2xl font-bold text-primary">{formatCurrency(totalImplementation)}</h3>
          <p className="text-xs text-muted-foreground mt-1">Valor total de implantações fechadas</p>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border shadow-sm border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Mensalidade</span>
            <span className="text-xs bg-success/10 text-success px-2 py-1 rounded font-bold">
              Recorrente
            </span>
          </div>
          <h3 className="text-2xl font-bold text-success">{formatCurrency(totalMonthly)}</h3>
          <p className="text-xs text-muted-foreground mt-1">Receita mensal recorrente (MRR)</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 bg-muted border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <CheckCircle size={18} className="text-success" />
            Vendas Fechadas ({wonLeads.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Empresa</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Implantação</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Mensalidade</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {wonLeads.map(lead => (
                <tr key={lead.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 text-sm font-medium text-foreground">{lead.name}</td>
                  <td className="p-3 text-sm text-muted-foreground">{lead.company || '-'}</td>
                  <td className="p-3 text-sm text-muted-foreground">{lead.confection_type || '-'}</td>
                  <td className="p-3 text-sm font-bold text-primary text-right">{formatCurrency(lead.implementation_value || 0)}</td>
                  <td className="p-3 text-sm font-bold text-success text-right">{formatCurrency(lead.monthly_value || 0)}</td>
                  <td className="p-3 text-sm text-muted-foreground">{formatDate(lead.updated_at)}</td>
                </tr>
              ))}
              {wonLeads.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhuma venda fechada ainda. Continue prospectando!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}