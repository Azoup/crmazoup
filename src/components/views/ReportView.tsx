import { useState, useMemo, useCallback } from 'react';
import { Lead, STAGE_LABELS, MEETING_STATUS_LABELS } from '@/types/lead';
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
  FileText, Presentation, Calendar, Users, ChevronDown, ChevronUp, Shirt
} from 'lucide-react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import jsPDF from 'jspdf';

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
  const [selectedMonth, setSelectedMonth] = useState(getCurrentReferenceMonth());
  const [period, setPeriod] = useState<ReportPeriod>('daily');

  const monthlyLeads = useMemo(() => {
    return leads.filter(lead => lead.reference_month === selectedMonth);
  }, [leads, selectedMonth]);

  // Build daily snapshots for the month
  const dailySnapshots = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const snapshots: DailySnapshot[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, day);
      if (dayDate > new Date()) break; // Don't show future days

      // Leads that had activity on this day
      const dayLeads = leads.filter(lead => {
        const entryDate = lead.entry_date?.substring(0, 10);
        const meetingDate = lead.meeting_date?.substring(0, 10);
        const updatedDate = lead.updated_at?.substring(0, 10);
        return entryDate === dateStr || meetingDate === dateStr || updatedDate === dateStr;
      });

      const agendados = leads.filter(l => {
        const md = l.meeting_date?.substring(0, 10);
        return md === dateStr && l.meeting_status !== 'no_show';
      }).length;

      const naoAgendados = leads.filter(l => {
        const ed = l.entry_date?.substring(0, 10);
        return ed === dateStr && !l.meeting_date && l.stage === 'prospeccao';
      }).length;

      const noShow = leads.filter(l => {
        const md = l.meeting_date?.substring(0, 10);
        return md === dateStr && l.meeting_status === 'no_show';
      }).length;

      const reagendados = leads.filter(l => {
        const md = l.meeting_date?.substring(0, 10);
        return md === dateStr && l.meeting_status === 'reagendar';
      }).length;

      const congelados = leads.filter(l => {
        const ud = l.updated_at?.substring(0, 10);
        return ud === dateStr && l.stage === 'congelados';
      }).length;

      const descartados = leads.filter(l => {
        const ud = l.updated_at?.substring(0, 10);
        return ud === dateStr && l.stage === 'perdidos';
      }).length;

      const vendas = leads.filter(l => {
        const ud = l.updated_at?.substring(0, 10);
        return ud === dateStr && l.stage === 'venda';
      }).length;

      snapshots.push({ date: dateStr, agendados, naoAgendados, noShow, reagendados, congelados, descartados, vendas });
    }

    return snapshots;
  }, [leads, selectedMonth]);

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

  // Monthly totals
  const monthlyTotals = useMemo(() => {
    return dailySnapshots.reduce(
      (acc, day) => ({
        date: formatReferenceMonth(selectedMonth),
        agendados: acc.agendados + day.agendados,
        naoAgendados: acc.naoAgendados + day.naoAgendados,
        noShow: acc.noShow + day.noShow,
        reagendados: acc.reagendados + day.reagendados,
        congelados: acc.congelados + day.congelados,
        descartados: acc.descartados + day.descartados,
        vendas: acc.vendas + day.vendas,
      }),
      { date: '', agendados: 0, naoAgendados: 0, noShow: 0, reagendados: 0, congelados: 0, descartados: 0, vendas: 0 }
    );
  }, [dailySnapshots, selectedMonth]);

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

  const generatePDF = useCallback((reportPeriod: 'weekly' | 'monthly') => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const data = reportPeriod === 'weekly' ? weeklySnapshots : [monthlyTotals];
    const title = reportPeriod === 'weekly'
      ? `Relatório Semanal - ${formatReferenceMonth(selectedMonth)}`
      : `Relatório Mensal - ${formatReferenceMonth(selectedMonth)}`;

    // Header
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, 297, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Azoup CRM', 15, 15);
    doc.setFontSize(12);
    doc.text(title, 15, 24);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 230, 24);

    // Table header
    let y = 40;
    doc.setFillColor(240, 240, 245);
    doc.rect(10, y - 5, 277, 10, 'F');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const cols = ['Período', 'Agendados', 'Não Agendou', 'No Show', 'Reagendou', 'Congelados', 'Descartados', 'Vendas'];
    const colX = [15, 65, 100, 140, 170, 205, 237, 267];
    cols.forEach((col, i) => doc.text(col, colX[i], y + 2));

    // Rows
    doc.setFont('helvetica', 'normal');
    data.forEach((row, idx) => {
      y += 12;
      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 252);
        doc.rect(10, y - 5, 277, 10, 'F');
      }
      doc.setTextColor(30, 30, 30);
      const vals = [row.date, String(row.agendados), String(row.naoAgendados), String(row.noShow), String(row.reagendados), String(row.congelados), String(row.descartados), String(row.vendas)];
      vals.forEach((v, i) => doc.text(v, colX[i], y + 2));
    });

    // Loss reasons section
    y += 25;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('Principais Motivos de Perda', 15, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    lossReasons.slice(0, 8).forEach((r, i) => {
      doc.setTextColor(50, 50, 50);
      doc.text(`${i + 1}. ${r.reason}`, 15, y);
      doc.text(`${r.count}x (${r.percent.toFixed(0)}%)`, 130, y);
      // Mini bar
      doc.setFillColor(220, 53, 69);
      doc.rect(160, y - 3, Math.max(1, r.percent * 0.8), 4, 'F');
      y += 8;
    });

    // Freeze reasons
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('Motivos de Congelamento', 15, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    freezeReasons.slice(0, 5).forEach((r, i) => {
      doc.setTextColor(50, 50, 50);
      doc.text(`${i + 1}. ${r.reason}`, 15, y);
      doc.text(`${r.count}x (${r.percent.toFixed(0)}%)`, 130, y);
      doc.setFillColor(59, 130, 246);
      doc.rect(160, y - 3, Math.max(1, r.percent * 0.8), 4, 'F');
      y += 8;
    });

    // Lead details page (congelados + perdidos)
    const detailLeads = monthlyLeads.filter(l => l.stage === 'congelados' || l.stage === 'perdidos');
    if (detailLeads.length > 0) {
      doc.addPage('landscape');
      // Header
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, 297, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('Detalhes - Congelados e Perdidos', 15, 15);
      doc.setFontSize(10);
      doc.text(title, 15, 24);

      // Table header
      let dy = 40;
      doc.setFillColor(240, 240, 245);
      doc.rect(10, dy - 5, 277, 10, 'F');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const detCols = ['Lead', 'Empresa', 'Tipo Confeccao', 'Etapa', 'Motivo', 'Observacao'];
      const detX = [15, 60, 110, 155, 190, 245];
      detCols.forEach((col, i) => doc.text(col, detX[i], dy + 2));

      doc.setFont('helvetica', 'normal');
      const pageH2 = doc.internal.pageSize.getHeight();
      detailLeads.forEach((lead, idx) => {
        dy += 11;
        if (dy > pageH2 - 25) {
          // New page
          doc.addPage('landscape');
          dy = 20;
          doc.setFillColor(240, 240, 245);
          doc.rect(10, dy - 5, 277, 10, 'F');
          doc.setFont('helvetica', 'bold');
          detCols.forEach((col, i) => doc.text(col, detX[i], dy + 2));
          doc.setFont('helvetica', 'normal');
          dy += 11;
        }
        if (idx % 2 === 0) {
          doc.setFillColor(248, 248, 252);
          doc.rect(10, dy - 5, 277, 10, 'F');
        }
        doc.setTextColor(30, 30, 30);
        const truncate = (s: string, max: number) => s && s.length > max ? s.substring(0, max) + '...' : (s || '-');
        doc.text(truncate(lead.name, 22), detX[0], dy + 2);
        doc.text(truncate(lead.company || '', 22), detX[1], dy + 2);
        doc.text(truncate(lead.confection_type || '', 20), detX[2], dy + 2);
        doc.text(STAGE_LABELS[lead.stage] || lead.stage, detX[3], dy + 2);
        doc.text(truncate(lead.loss_reason || '', 25), detX[4], dy + 2);
        doc.text(truncate(lead.client_observations || lead.manager_notes || '', 25), detX[5], dy + 2);
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const pH = doc.internal.pageSize.getHeight();
      doc.setFillColor(30, 58, 95);
      doc.rect(0, pH - 12, 297, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(`Azoup CRM - Relatório gerado automaticamente | Página ${p}/${totalPages}`, 15, pH - 4);
    }

    doc.save(`relatorio_${reportPeriod}_${selectedMonth}.pdf`);
  }, [weeklySnapshots, monthlyTotals, selectedMonth, lossReasons, freezeReasons, monthlyLeads]);

  // Summary cards
  const summaryCards = [
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
          <p className="text-sm text-muted-foreground mt-1">Acompanhamento diário de leads e resultados</p>
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
          <Button onClick={() => generatePDF('monthly')} size="sm" className="gap-1.5">
            <Download size={14} />
            PDF Mensal
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      {/* Lead Details with Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users size={18} className="text-primary" />
            Detalhes por Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Lead</TableHead>
                  <TableHead className="font-bold">Empresa</TableHead>
                  <TableHead className="font-bold"><span className="flex items-center gap-1"><Shirt size={12} /> Tipo Confecção</span></TableHead>
                  <TableHead className="font-bold">Etapa</TableHead>
                  <TableHead className="font-bold">Status Reunião</TableHead>
                  <TableHead className="font-bold">Motivo</TableHead>
                  <TableHead className="font-bold">Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum lead neste mês
                    </TableCell>
                  </TableRow>
                ) : (
                  monthlyLeads.map(lead => (
                    <TableRow key={lead.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.company || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {lead.confection_type ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                            <Shirt size={10} /> {lead.confection_type}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 bg-muted rounded-full font-medium">
                          {STAGE_LABELS[lead.stage] || lead.stage}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {lead.meeting_status ? MEETING_STATUS_LABELS[lead.meeting_status] || lead.meeting_status : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {lead.loss_reason || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {lead.client_observations || lead.manager_notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
