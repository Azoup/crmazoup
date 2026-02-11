import { useMemo, useCallback } from 'react';
import { Lead, STAGE_LABELS } from '@/types/lead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { 
  ThermometerSun, XCircle, AlertTriangle, TrendingDown, 
  BarChart3, Users, Snowflake, Target, Download
} from 'lucide-react';

interface QualificationViewProps {
  leads: Lead[];
}

interface LossReasonStat {
  reason: string;
  count: number;
  percent: number;
}

export function QualificationView({ leads }: QualificationViewProps) {
  const stats = useMemo(() => {
    const total = leads.length;
    const lost = leads.filter(l => l.stage === 'perdidos');
    const frozen = leads.filter(l => l.stage === 'congelados');
    const disqualified = [...lost, ...frozen];
    const qualified = leads.filter(l => !['perdidos', 'congelados'].includes(l.stage));
    const inSale = leads.filter(l => l.stage === 'venda');
    const inMeeting = leads.filter(l => l.stage === 'reuniao');
    const inProposal = leads.filter(l => l.stage === 'proposta');

    // Qualification rate = leads that progressed beyond prospeccao / total
    const progressed = leads.filter(l => l.stage !== 'prospeccao' && l.stage !== 'perdidos' && l.stage !== 'congelados');
    const qualificationRate = total > 0 ? (progressed.length / total) * 100 : 0;

    // Conversion funnel rate
    const conversionRate = total > 0 ? (inSale.length / total) * 100 : 0;

    // Loss reasons breakdown
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

    // Stage distribution for disqualified leads
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
  }, [leads]);

  // Thermometer color based on qualification rate
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

  const downloadCSV = useCallback(() => {
    const headers = ['Lead', 'Empresa', 'Tipo', 'Status', 'Motivo', 'Data de Atualização'];
    const rows = stats.disqualified
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map(lead => [
        lead.name,
        lead.company || '-',
        lead.confection_type || '-',
        STAGE_LABELS[lead.stage] || lead.stage,
        lead.loss_reason || '-',
        formatDate(lead.updated_at),
      ]);

    // Summary section
    const summary = [
      [],
      ['--- RESUMO ---'],
      ['Total de Leads', stats.total.toString()],
      ['Taxa de Qualificação', `${stats.qualificationRate.toFixed(1)}%`],
      ['Taxa de Desqualificação', `${stats.disqualificationRate.toFixed(1)}%`],
      ['Taxa de Conversão', `${stats.conversionRate.toFixed(1)}%`],
      ['Leads Perdidos', stats.lost.length.toString()],
      ['Leads Congelados', stats.frozen.length.toString()],
      [],
      ['--- MOTIVOS DE PERDA ---'],
      ...stats.lossReasonStats.map(s => [s.reason, `${s.count} (${s.percent.toFixed(0)}%)`]),
    ];

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(c => `"${c}"`).join(';')),
      ...summary.map(r => r.join(';')),
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-qualificacao-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Download button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2">
          <Download size={14} />
          Baixar Relatório CSV
        </Button>
      </div>
      {/* Thermometer Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Thermometer */}
        <Card className="md:col-span-1 relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ThermometerSun size={16} className={getThermometerColor(stats.qualificationRate)} />
              Termômetro de Qualificação
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-2">
            {/* Vertical thermometer */}
            <div className="relative w-16 h-48 rounded-full bg-muted border-2 border-border overflow-hidden flex flex-col justify-end mb-3">
              <div
                className={`w-full bg-gradient-to-t ${getThermometerBg(stats.qualificationRate)} transition-all duration-1000 rounded-b-full`}
                style={{ height: `${Math.max(5, stats.qualificationRate)}%` }}
              />
              {/* Scale marks */}
              {[25, 50, 75].map(mark => (
                <div
                  key={mark}
                  className="absolute left-0 right-0 border-t border-border/50"
                  style={{ bottom: `${mark}%` }}
                >
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

        {/* KPI Cards */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-primary/10 p-2.5 rounded-full">
                  <Users size={18} className="text-primary" />
                </div>
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
                <div className="bg-destructive/10 p-2.5 rounded-full">
                  <XCircle size={18} className="text-destructive" />
                </div>
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
                <div className="bg-info/10 p-2.5 rounded-full">
                  <Snowflake size={18} className="text-info" />
                </div>
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
                <div className="bg-success/10 p-2.5 rounded-full">
                  <Target size={18} className="text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.conversionRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Disqualification Rate Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingDown size={16} className="text-destructive" />
            Taxa de Desqualificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={stats.disqualificationRate} className="h-4" />
            </div>
            <span className="text-lg font-bold text-destructive min-w-[60px] text-right">
              {stats.disqualificationRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.disqualified.length} de {stats.total} leads foram desqualificados (Perdidos + Congelados)
          </p>
        </CardContent>
      </Card>

      {/* Loss Reasons Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 size={16} className="text-warning" />
            Motivos de Perda ({stats.lost.length} leads)
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
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${lossReasonColors[i % lossReasonColors.length]}`}
                      style={{ width: `${stat.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum lead perdido até o momento. 🎉
            </p>
          )}
        </CardContent>
      </Card>

      {/* Disqualified Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            Leads Desqualificados ({stats.disqualified.length})
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
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Motivo</th>
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
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          lead.stage === 'perdidos'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-info/10 text-info'
                        }`}>
                          {STAGE_LABELS[lead.stage] || lead.stage}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.loss_reason || '-'}</td>
                      <td className="p-3 text-sm text-muted-foreground">{formatDate(lead.updated_at)}</td>
                    </tr>
                  ))}
                {stats.disqualified.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Nenhum lead desqualificado. Continue prospectando! 🚀
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
