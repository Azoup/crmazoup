import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/lead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { formatDate, formatCurrency } from '@/lib/utils';
import { getCurrentReferenceMonth, formatReferenceMonth } from '@/hooks/useMonthlyMetrics';
import {
  CalendarCheck, CalendarX, UserX, RefreshCw, Snowflake, XCircle,
  Download, ChevronLeft, ChevronRight, BarChart3, TrendingDown,
  FileText, Calendar, Users
} from 'lucide-react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  buildLeadReportRows,
  computeMonthlySnapshotTotals,
  filterLeadsForMonthlyReport,
  groupLeadsByWeek,
  LEAD_REPORT_COLUMNS,
  type LeadReportRow,
  type WeeklyReportSection,
} from '@/lib/leadReportTable';
import { buildMonthlyFullTablePdf, buildWeeklyFullTablePdf } from '@/lib/leadReportTablePdf';
import {
  downloadMonthlyLeadReportXlsx,
  downloadWeeklyLeadReportXlsx,
} from '@/lib/leadReportSpreadsheet';
import { ReportCharts } from '@/components/views/ReportCharts';

interface ReportViewProps {
  leads: Lead[];
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

interface DailySnapshot {
  date: string;
  agendados: number;
  naoAgendados: number;
  noShow: number;
  reagendados: number;
  congelados: number;
  descartados: number;
  vendas: number;
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function getWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const startDay = (week - 1) * 7 - dayOfWeek + 1;
  const start = new Date(year, 0, startDay);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function ReportView({ leads }: ReportViewProps) {
  const { user, profile } = useAuth();
  const isManager = profile?.role === 'Gestor';
  const [selectedMonth, setSelectedMonth] = useState(getCurrentReferenceMonth());
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [stageFilter, setStageFilter] = useState<string>('todos');

  /** Mesmo universo do CRM: reference_month + marketing; SDR só vê os próprios leads. */
  const monthlyLeads = useMemo(() => {
    return filterLeadsForMonthlyReport(
      leads,
      selectedMonth,
      isManager ? null : user?.id,
    );
  }, [leads, selectedMonth, user?.id, isManager]);

  const filteredDetailLeads = useMemo(() => {
    if (stageFilter === 'todos') return monthlyLeads;
    if (stageFilter === 'no_show') return monthlyLeads.filter(l => l.meeting_status === 'no_show');
    if (stageFilter === 'compareceu') return monthlyLeads.filter(l => l.meeting_status === 'compareceu');
    if (stageFilter === 'reagendar') return monthlyLeads.filter(l => l.meeting_status === 'reagendar');
    return monthlyLeads.filter(l => l.stage === stageFilter);
  }, [monthlyLeads, stageFilter]);


  // Build daily snapshots for the month
  const dailySnapshots = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const snapshots: DailySnapshot[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, day);
      if (dayDate > new Date()) break; // Don't show future days

      const agendados = monthlyLeads.filter((l) => {
        const md = l.meeting_date?.substring(0, 10);
        return md === dateStr && l.meeting_status !== 'no_show';
      }).length;

      const naoAgendados = monthlyLeads.filter((l) => {
        const ed = l.entry_date?.substring(0, 10);
        return ed === dateStr && !l.meeting_date && l.stage === 'prospeccao';
      }).length;

      const noShow = monthlyLeads.filter((l) => {
        const md = l.meeting_date?.substring(0, 10);
        return md === dateStr && l.meeting_status === 'no_show';
      }).length;

      const reagendados = monthlyLeads.filter((l) => {
        const md = l.meeting_date?.substring(0, 10);
        return md === dateStr && l.meeting_status === 'reagendar';
      }).length;

      const congelados = monthlyLeads.filter((l) => {
        const ud = l.updated_at?.substring(0, 10);
        return ud === dateStr && l.stage === 'congelados';
      }).length;

      const descartados = monthlyLeads.filter((l) => {
        const ud = l.updated_at?.substring(0, 10);
        return ud === dateStr && l.stage === 'perdidos';
      }).length;

      const vendas = monthlyLeads.filter((l) => {
        const ud = l.updated_at?.substring(0, 10);
        return ud === dateStr && l.stage === 'venda';
      }).length;

      snapshots.push({ date: dateStr, agendados, naoAgendados, noShow, reagendados, congelados, descartados, vendas });
    }

    return snapshots;
  }, [monthlyLeads, selectedMonth]);

  // Weekly aggregation
  const weeklySnapshots = useMemo(() => {
    const weeks: Record<number, DailySnapshot> = {};
    dailySnapshots.forEach(day => {
      const d = new Date(day.date + 'T12:00:00');
      const wk = getWeekNumber(d);
      if (!weeks[wk]) {
        weeks[wk] = { date: `Semana ${wk}`, agendados: 0, naoAgendados: 0, noShow: 0, reagendados: 0, congelados: 0, descartados: 0, vendas: 0 };
      }
      weeks[wk].agendados += day.agendados;
      weeks[wk].naoAgendados += day.naoAgendados;
      weeks[wk].noShow += day.noShow;
      weeks[wk].reagendados += day.reagendados;
      weeks[wk].congelados += day.congelados;
      weeks[wk].descartados += day.descartados;
      weeks[wk].vendas += day.vendas;
    });
    return Object.values(weeks);
  }, [dailySnapshots]);

  // Totais do mês: leads únicos (não soma linhas diárias — evita 147 vs 76 no CRM)
  const monthlyTotals = useMemo(() => {
    const totals = computeMonthlySnapshotTotals(monthlyLeads, selectedMonth);
    return {
      date: formatReferenceMonth(selectedMonth),
      ...totals,
    };
  }, [monthlyLeads, selectedMonth]);

  // Loss reasons dashboard
  const lossReasons = useMemo(() => {
    const lost = monthlyLeads.filter(l => l.stage === 'perdidos');
    const reasons: Record<string, number> = {};
    lost.forEach(l => {
      const reason = l.loss_reason || 'Não Informado';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count, percent: lost.length > 0 ? (count / lost.length) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [monthlyLeads]);

  // Freeze reasons
  const freezeReasons = useMemo(() => {
    const frozen = monthlyLeads.filter(l => l.stage === 'congelados');
    const reasons: Record<string, number> = {};
    frozen.forEach(l => {
      const reason = l.loss_reason || 'Não Informado';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count, percent: frozen.length > 0 ? (count / frozen.length) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [monthlyLeads]);

  const displayData = period === 'daily' ? dailySnapshots : period === 'weekly' ? weeklySnapshots : [monthlyTotals];

  const navigateMonth = (dir: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const fullTableRows = useMemo(() => buildLeadReportRows(monthlyLeads), [monthlyLeads]);

  const weeklyTableGroups = useMemo(
    () => groupLeadsByWeek(monthlyLeads, selectedMonth),
    [monthlyLeads, selectedMonth],
  );

  const weeklyExportSections = useMemo<WeeklyReportSection[]>(
    () =>
      weeklyTableGroups.map((g) => ({
        label: g.label,
        rows: buildLeadReportRows(g.leads),
      })),
    [weeklyTableGroups],
  );

  const exportSpreadsheet = useCallback(
    (reportPeriod: 'weekly' | 'monthly') => {
      const monthLabel = formatReferenceMonth(selectedMonth);
      if (reportPeriod === 'monthly') {
        downloadMonthlyLeadReportXlsx(
          `relatorio_mensal_${selectedMonth}.xlsx`,
          fullTableRows,
          monthLabel,
        );
        return;
      }
      downloadWeeklyLeadReportXlsx(
        `relatorio_semanal_${selectedMonth}.xlsx`,
        weeklyExportSections,
        monthLabel,
      );
    },
    [fullTableRows, weeklyExportSections, selectedMonth],
  );

  const generatePDF = useCallback(
    (reportPeriod: 'weekly' | 'monthly') => {
      const monthLabel = formatReferenceMonth(selectedMonth);
      if (reportPeriod === 'monthly') {
        buildMonthlyFullTablePdf(fullTableRows, monthLabel).save(
          `relatorio_mensal_${selectedMonth}.pdf`,
        );
        return;
      }
      buildWeeklyFullTablePdf(weeklyExportSections, monthLabel).save(
        `relatorio_semanal_${selectedMonth}.pdf`,
      );
    },
    [fullTableRows, weeklyExportSections, selectedMonth],
  );

  const filteredReportRows = useMemo(
    () => buildLeadReportRows(filteredDetailLeads),
    [filteredDetailLeads],
  );

  const weeklyReportGroups = useMemo(
    () =>
      groupLeadsByWeek(filteredDetailLeads, selectedMonth).map((g) => ({
        ...g,
        rows: buildLeadReportRows(g.leads),
      })),
    [filteredDetailLeads, selectedMonth],
  );

  const renderFullTableBody = (rows: LeadReportRow[]) => (
    <>
      {rows.length === 0 ? (
        <TableRow>
          <TableCell colSpan={LEAD_REPORT_COLUMNS.length} className="text-center text-muted-foreground py-8">
            Nenhum lead encontrado para este filtro
          </TableCell>
        </TableRow>
      ) : (
        rows.map((row, idx) => (
          <TableRow key={idx} className={idx % 2 === 0 ? 'bg-muted/20 hover:bg-muted/30' : 'hover:bg-muted/30'}>
            {LEAD_REPORT_COLUMNS.map((col) => (
              <TableCell
                key={col.key}
                className="text-xs py-2 max-w-[140px] truncate"
                title={row[col.key]}
              >
                {row[col.key]}
              </TableCell>
            ))}
          </TableRow>
        ))
      )}
    </>
  );

  // Summary cards
  const summaryCards = [
    { label: 'Leads no mês', value: monthlyLeads.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Agendados', value: monthlyTotals.agendados, icon: CalendarCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Não Agendaram', value: monthlyTotals.naoAgendados, icon: CalendarX, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'No Show', value: monthlyTotals.noShow, icon: UserX, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Reagendaram', value: monthlyTotals.reagendados, icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Congelados', value: monthlyTotals.congelados, icon: Snowflake, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { label: 'Descartados', value: monthlyTotals.descartados, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText size={24} className="text-primary" />
            Relatórios
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Leads de marketing com mês de referência {formatReferenceMonth(selectedMonth)} — alinhado ao dashboard do CRM
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Month Navigator */}
          <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2">
            <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-muted rounded-lg transition">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold min-w-[120px] text-center">{formatReferenceMonth(selectedMonth)}</span>
            <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-muted rounded-lg transition">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex bg-card rounded-xl border border-border p-1 gap-1">
            {([['daily', 'Diário'], ['weekly', 'Semanal'], ['monthly', 'Mensal']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  period === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <Button onClick={() => generatePDF('weekly')} size="sm" variant="outline" className="gap-1.5">
            <Download size={14} />
            PDF Semanal
          </Button>
          <Button onClick={() => exportSpreadsheet('weekly')} size="sm" variant="outline" className="gap-1.5">
            <Download size={14} />
            Planilha Semanal
          </Button>
          <Button onClick={() => generatePDF('monthly')} size="sm" className="gap-1.5">
            <Download size={14} />
            PDF Mensal
          </Button>
          <Button onClick={() => exportSpreadsheet('monthly')} size="sm" variant="secondary" className="gap-1.5">
            <Download size={14} />
            Planilha Mensal
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {summaryCards.map(card => (
          <Card key={card.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon size={16} className={card.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics charts */}
      <ReportCharts allLeads={leads} monthlyLeads={monthlyLeads} selectedMonth={selectedMonth} />


      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            {period === 'daily' ? 'Relatório Diário' : period === 'weekly' ? 'Relatório Semanal' : 'Relatório Mensal'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Período</TableHead>
                  <TableHead className="text-center font-bold">Agendados</TableHead>
                  <TableHead className="text-center font-bold">Não Agendou</TableHead>
                  <TableHead className="text-center font-bold">No Show</TableHead>
                  <TableHead className="text-center font-bold">Reagendou</TableHead>
                  <TableHead className="text-center font-bold">Congelados</TableHead>
                  <TableHead className="text-center font-bold">Descartados</TableHead>
                  <TableHead className="text-center font-bold">Vendas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum dado para este período
                    </TableCell>
                  </TableRow>
                ) : (
                  displayData.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {period === 'daily' ? formatDate(row.date) : row.date}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-sm">
                          {row.agendados}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 font-bold text-sm">
                          {row.naoAgendados}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-600 font-bold text-sm">
                          {row.noShow}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 font-bold text-sm">
                          {row.reagendados}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 font-bold text-sm">
                          {row.congelados}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 font-bold text-sm">
                          {row.descartados}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-sm">
                          {row.vendas}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Reasons Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Loss Reasons */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown size={18} className="text-red-500" />
              Maiores Motivos de Perda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lossReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma perda registrada</p>
            ) : (
              lossReasons.map((r, i) => (
                <div key={r.reason} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {i + 1}. {r.reason}
                    </span>
                    <span className="text-muted-foreground font-semibold">{r.count}x ({r.percent.toFixed(0)}%)</span>
                  </div>
                  <Progress value={r.percent} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Freeze Reasons */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Snowflake size={18} className="text-cyan-500" />
              Motivos de Congelamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {freezeReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum congelamento registrado</p>
            ) : (
              freezeReasons.map((r, i) => (
                <div key={r.reason} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {i + 1}. {r.reason}
                    </span>
                    <span className="text-muted-foreground font-semibold">{r.count}x ({r.percent.toFixed(0)}%)</span>
                  </div>
                  <Progress value={r.percent} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela completa por lead */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users size={18} className="text-primary" />
                Tabela completa por lead
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {filteredDetailLeads.length} {filteredDetailLeads.length === 1 ? 'lead' : 'leads'}
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Modelo para cruzar cada lead com origem, campanha, conjunto, anúncio, status comercial e resultado final.
              </p>
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 px-3 border border-border rounded-md text-sm bg-card outline-none font-medium text-foreground shrink-0"
            >
              <option value="todos">Todos os status</option>
              <option value="prospeccao">Prospecção</option>
              <option value="interesse">Interesse</option>
              <option value="reuniao">Reunião</option>
              <option value="proposta">Proposta</option>
              <option value="venda">Vendas (Ganhos)</option>
              <option value="congelados">Congelados</option>
              <option value="perdidos">Perdidos</option>
              <option value="compareceu">Reuniões: Compareceu</option>
              <option value="no_show">Reuniões: No Show</option>
              <option value="reagendar">Reuniões: Reagendou</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {period === 'weekly' && weeklyReportGroups.length > 0 ? (
            weeklyReportGroups.map((group) => (
              <div key={group.week} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{group.label}</h4>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-black hover:bg-black">
                        {LEAD_REPORT_COLUMNS.map((col) => (
                          <TableHead key={col.key} className="text-white font-bold text-xs whitespace-nowrap">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>{renderFullTableBody(group.rows)}</TableBody>
                  </Table>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-black hover:bg-black">
                    {LEAD_REPORT_COLUMNS.map((col) => (
                      <TableHead key={col.key} className="text-white font-bold text-xs whitespace-nowrap">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>{renderFullTableBody(filteredReportRows)}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
