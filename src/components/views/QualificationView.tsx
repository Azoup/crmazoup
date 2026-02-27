import { useState, useMemo, useCallback } from 'react';
import { Lead, STAGE_LABELS } from '@/types/lead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { getCurrentReferenceMonth, formatReferenceMonth } from '@/hooks/useMonthlyMetrics';
import { 
  ThermometerSun, XCircle, AlertTriangle, TrendingDown, 
  BarChart3, Users, Snowflake, Target, Download,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface QualificationViewProps {
  leads: Lead[];
}

interface LossReasonStat {
  reason: string;
  count: number;
  percent: number;
}

export function QualificationView({ leads }: QualificationViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentReferenceMonth());

  // Filter leads by selected month
  const monthlyLeads = useMemo(() => {
    return leads.filter(lead => lead.reference_month === selectedMonth);
  }, [leads, selectedMonth]);

  const stats = useMemo(() => {
    const total = monthlyLeads.length;
    const lost = monthlyLeads.filter(l => l.stage === 'perdidos');
    const frozen = monthlyLeads.filter(l => l.stage === 'congelados');
    const disqualified = [...lost, ...frozen];
    const qualified = monthlyLeads.filter(l => !['perdidos', 'congelados'].includes(l.stage));
    const inSale = monthlyLeads.filter(l => l.stage === 'venda');
    const inMeeting = monthlyLeads.filter(l => l.stage === 'reuniao');
    const inProposal = monthlyLeads.filter(l => l.stage === 'proposta');

    const progressed = monthlyLeads.filter(l => l.stage !== 'prospeccao' && l.stage !== 'perdidos' && l.stage !== 'congelados');
    const qualificationRate = total > 0 ? (progressed.length / total) * 100 : 0;
    const conversionRate = total > 0 ? (inSale.length / total) * 100 : 0;

    const lossReasons: Record<string, number> = {};
    lost.forEach(l => {
      const reason = l.loss_reason || 'Não Informado';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    });

    const lossReasonStats: LossReasonStat[] = Object.entries(lossReasons)
      .map(([reason, count]) => ({
        reason,
        count,
        percent: lost.length > 0 ? (count / lost.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const disqualificationRate = total > 0 ? (disqualified.length / total) * 100 : 0;

    return {
      total,
      lost,
      frozen,
      disqualified,
      qualified,
      inSale,
      inMeeting,
      inProposal,
      progressed,
      qualificationRate,
      conversionRate,
      disqualificationRate,
      lossReasonStats,
    };
  }, [monthlyLeads]);

  const getThermometerColor = (rate: number) => {
    if (rate >= 60) return 'text-success';
    if (rate >= 35) return 'text-warning';
    return 'text-destructive';
  };

  const getThermometerBg = (rate: number) => {
    if (rate >= 60) return 'from-success/80 to-success';
    if (rate >= 35) return 'from-warning/80 to-warning';
    return 'from-destructive/80 to-destructive';
  };

  const getThermometerLabel = (rate: number) => {
    if (rate >= 70) return 'Excelente';
    if (rate >= 50) return 'Bom';
    if (rate >= 35) return 'Regular';
    if (rate >= 20) return 'Baixo';
    return 'Crítico';
  };

  const lossReasonColors = [
    'bg-destructive/80', 'bg-warning/80', 'bg-primary/80', 'bg-info/80', 'bg-muted-foreground/50'
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    if (direction === 'prev') date.setMonth(date.getMonth() - 1);
    else date.setMonth(date.getMonth() + 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const downloadExcel = useCallback(() => {
    const rows = stats.disqualified
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map(lead => ({
        'Lead': lead.name,
        'Empresa': lead.company || '-',
        'Tipo de Confecção': lead.confection_type || '-',
        'WhatsApp': lead.whatsapp || '-',
        'Email': lead.email || '-',
        'Website': lead.website || '-',
        'Status': STAGE_LABELS[lead.stage] || lead.stage,
        'Temperatura': lead.temperature,
        'Motivo Perda/Congelamento': lead.loss_reason || '-',
        'Próximo Contato': lead.next_contact ? lead.next_contact.replace('T', ' ').slice(0, 16) : '-',
        'Valor Implantação (R$)': Number(lead.implementation_value || 0),
        'Valor Mensalidade (R$)': Number(lead.monthly_value || 0),
        'Peças/Mês': lead.pieces_per_month ?? '-',
        'Dores Identificadas': lead.meeting_pain || '-',
        'Data Reunião': lead.meeting_date ? lead.meeting_date.replace('T', ' ').slice(0, 16) : '-',
        'Data Entrada': formatDate(lead.entry_date),
        'Data Atualização': formatDate(lead.updated_at),
        'Origem': lead.lead_source === 'prospeccao_ativa' ? 'Prospecção Ativa' : lead.lead_source === 'indicacao' ? 'Indicação' : 'Marketing',
      }));

    const summaryRows = [
      {},
      { 'Lead': '--- RESUMO ---' },
      { 'Lead': 'Período', 'Empresa': formatReferenceMonth(selectedMonth) },
      { 'Lead': 'Total de Leads', 'Empresa': stats.total },
      { 'Lead': 'Taxa de Qualificação', 'Empresa': `${stats.qualificationRate.toFixed(1)}%` },
      { 'Lead': 'Taxa de Desqualificação', 'Empresa': `${stats.disqualificationRate.toFixed(1)}%` },
      { 'Lead': 'Taxa de Conversão', 'Empresa': `${stats.conversionRate.toFixed(1)}%` },
      { 'Lead': 'Leads Perdidos', 'Empresa': stats.lost.length },
      { 'Lead': 'Leads Congelados', 'Empresa': stats.frozen.length },
      {},
      { 'Lead': '--- MOTIVOS DE PERDA ---' },
      ...stats.lossReasonStats.map(s => ({ 'Lead': s.reason, 'Empresa': `${s.count} (${s.percent.toFixed(0)}%)` })),
    ];

    const ws = XLSX.utils.json_to_sheet([...rows, ...summaryRows]);
    
    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Qualificação');
    XLSX.writeFile(wb, `relatorio-qualificacao-${selectedMonth}.xlsx`);
  }, [stats, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Month Navigator + Download */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 bg-card rounded-lg border border-border/50 p-2">
          <button onClick={() => navigateMonth('prev')} className="p-1.5 hover:bg-muted rounded">
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-foreground min-w-[150px] text-center">
            {formatReferenceMonth(selectedMonth)}
          </span>
          <button onClick={() => navigateMonth('next')} className="p-1.5 hover:bg-muted rounded">
            <ChevronRight size={18} />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={downloadExcel} className="gap-2">
          <Download size={14} />
          Baixar Excel (.xlsx)
        </Button>
      </div>

      {/* Thermometer Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ThermometerSun size={16} className={getThermometerColor(stats.qualificationRate)} />
              Termômetro de Qualificação
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-2">
            <div className="relative w-16 h-48 rounded-full bg-muted border-2 border-border overflow-hidden flex flex-col justify-end mb-3">
              <div
                className={`w-full bg-gradient-to-t ${getThermometerBg(stats.qualificationRate)} transition-all duration-1000 rounded-b-full`}
                style={{ height: `${Math.max(5, stats.qualificationRate)}%` }}
              />
              {[25, 50, 75].map(mark => (
                <div key={mark} className="absolute left-0 right-0 border-t border-border/50" style={{ bottom: `${mark}%` }}>
                  <span className="absolute -right-8 -top-2 text-[9px] text-muted-foreground">{mark}%</span>
                </div>
              ))}
            </div>
            <div className="text-center">
              <span className={`text-3xl font-bold ${getThermometerColor(stats.qualificationRate)}`}>
                {stats.qualificationRate.toFixed(1)}%
              </span>
              <p className={`text-xs font-semibold mt-1 ${getThermometerColor(stats.qualificationRate)}`}>
                {getThermometerLabel(stats.qualificationRate)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {stats.progressed.length} de {stats.total} leads qualificados
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-primary/10 p-2.5 rounded-full"><Users size={18} className="text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-destructive/10 p-2.5 rounded-full"><XCircle size={18} className="text-destructive" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.lost.length}</p>
                  <p className="text-xs text-muted-foreground">Leads Perdidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-info/10 p-2.5 rounded-full"><Snowflake size={18} className="text-info" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.frozen.length}</p>
                  <p className="text-xs text-muted-foreground">Congelados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-success/10 p-2.5 rounded-full"><Target size={18} className="text-success" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.conversionRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Disqualification Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingDown size={16} className="text-destructive" /> Taxa de Desqualificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1"><Progress value={stats.disqualificationRate} className="h-4" /></div>
            <span className="text-lg font-bold text-destructive min-w-[60px] text-right">
              {stats.disqualificationRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.disqualified.length} de {stats.total} leads desqualificados
          </p>
        </CardContent>
      </Card>

      {/* Loss Reasons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 size={16} className="text-warning" /> Motivos de Perda ({stats.lost.length} leads)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.lossReasonStats.length > 0 ? (
            <div className="space-y-3">
              {stats.lossReasonStats.map((stat, i) => (
                <div key={stat.reason}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">{stat.reason}</span>
                    <span className="text-xs text-muted-foreground">
                      {stat.count} lead{stat.count > 1 ? 's' : ''} ({stat.percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all duration-500 ${lossReasonColors[i % lossReasonColors.length]}`} style={{ width: `${stat.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead perdido neste mês. 🎉</p>
          )}
        </CardContent>
      </Card>

      {/* Disqualified Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" /> Leads Desqualificados ({stats.disqualified.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Lead</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">WhatsApp</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Motivo</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Origem</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {stats.disqualified
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                  .map(lead => (
                    <tr key={lead.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 text-sm font-medium text-foreground">{lead.name}</td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.company || '-'}</td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.confection_type || '-'}</td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.whatsapp || '-'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          lead.stage === 'perdidos' ? 'bg-destructive/10 text-destructive' : 'bg-info/10 text-info'
                        }`}>
                          {STAGE_LABELS[lead.stage] || lead.stage}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.loss_reason || '-'}</td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-muted text-muted-foreground">
                          {lead.lead_source === 'prospeccao_ativa' ? 'Prosp. Ativa' : lead.lead_source === 'indicacao' ? 'Indicação' : 'Marketing'}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{formatDate(lead.updated_at)}</td>
                    </tr>
                  ))}
                {stats.disqualified.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Nenhum lead desqualificado neste mês. 🚀
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
