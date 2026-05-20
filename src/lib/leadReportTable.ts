import { Lead, LeadStage, STAGE_LABELS, MEETING_STATUS_LABELS } from '@/types/lead';
import {
  getMeetingAttributionMonth,
  isMeetingNoShowInMonth,
  isMeetingScheduledInMonth,
} from '@/lib/meetingMetrics';

/** Mesmo critério do dashboard (métricas do perfil / pipeline marketing). */
export function isMarketingLead(lead: Lead): boolean {
  return !lead.lead_source || lead.lead_source === 'marketing';
}

/** Leads que pertencem ao mês de referência no CRM (marketing, opcionalmente por usuário). */
export function filterLeadsForMonthlyReport(
  leads: Lead[],
  month: string,
  userId?: string | null,
): Lead[] {
  return leads.filter((lead) => {
    if (lead.reference_month !== month) return false;
    if (!isMarketingLead(lead)) return false;
    if (userId && lead.user_id !== userId) return false;
    return true;
  });
}

export interface ReportSnapshotCounts {
  agendados: number;
  naoAgendados: number;
  noShow: number;
  reagendados: number;
  congelados: number;
  descartados: number;
  vendas: number;
}

/** Totais únicos do mês (não soma eventos por dia — evita inflar o relatório). */
export function computeMonthlySnapshotTotals(
  monthLeads: Lead[],
  month: string,
): ReportSnapshotCounts {
  return {
    agendados: monthLeads.filter(
      (l) => isMeetingScheduledInMonth(l, month) && l.meeting_status !== 'no_show',
    ).length,
    naoAgendados: monthLeads.filter(
      (l) =>
        ['prospeccao', 'interesse'].includes(l.stage) &&
        !l.meeting_date &&
        !isMeetingScheduledInMonth(l, month),
    ).length,
    noShow: monthLeads.filter((l) => isMeetingNoShowInMonth(l, month)).length,
    reagendados: monthLeads.filter(
      (l) => l.meeting_status === 'reagendar' && getMeetingAttributionMonth(l) === month,
    ).length,
    congelados: monthLeads.filter((l) => l.stage === 'congelados').length,
    descartados: monthLeads.filter((l) => l.stage === 'perdidos').length,
    vendas: monthLeads.filter((l) => l.stage === 'venda').length,
  };
}

/** Linha da tabela completa por lead (modelo relatório semanal/mensal) */
export interface LeadReportRow {
  lead: string;
  empresa: string;
  data: string;
  etapa: string;
  status: string;
  motivo: string;
  origem: string;
  campanha: string;
  conjunto: string;
  anuncio: string;
  lp: string;
  observacao: string;
}

export const LEAD_REPORT_COLUMNS: { key: keyof LeadReportRow; label: string }[] = [
  { key: 'lead', label: 'Lead' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'data', label: 'Data' },
  { key: 'etapa', label: 'Etapa' },
  { key: 'status', label: 'Status' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'origem', label: 'Origem' },
  { key: 'campanha', label: 'Campanha' },
  { key: 'conjunto', label: 'Conjunto' },
  { key: 'anuncio', label: 'Anúncio' },
  { key: 'lp', label: 'LP' },
  { key: 'observacao', label: 'Observação' },
];

export function getLeadActivityDateIso(lead: Lead): string | null {
  const raw = lead.meeting_date || lead.entry_date || lead.created_at || lead.updated_at;
  if (!raw) return null;
  return raw.substring(0, 10);
}

export function formatLeadActivityDate(lead: Lead): string {
  const iso = getLeadActivityDateIso(lead);
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function extractLandingPage(lead: Lead): string {
  const campaign = lead.utm_campaign || '';
  const brackets = [...campaign.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  const lpBracket = brackets.find((b) => /^LP\d/i.test(b) || /^LP\s*-/i.test(b) || b === 'LP');
  if (lpBracket && lpBracket !== 'LP') return lpBracket;
  const inline = campaign.match(/LP\s*0?(\d+[^\]\s,—-]*)/i);
  if (inline) return `LP${inline[1]}`.trim();
  if (lead.website?.trim()) return lead.website.trim();
  return '-';
}

export function formatReportEtapa(lead: Lead): string {
  if ((lead.stage === 'prospeccao' || lead.stage === 'interesse') && !lead.meeting_date) {
    return 'Não agendou';
  }
  return STAGE_LABELS[lead.stage as LeadStage] || lead.stage;
}

export function formatReportStatus(lead: Lead): string {
  if (lead.meeting_status) {
    return MEETING_STATUS_LABELS[lead.meeting_status] || lead.meeting_status;
  }
  if (lead.stage === 'venda') return 'Compareceu';
  if (['prospeccao', 'interesse'].includes(lead.stage) && !lead.meeting_date) {
    return 'Sem resposta';
  }
  if (lead.stage === 'perdidos') return 'Descartado';
  if (lead.stage === 'congelados') return 'Congelado';
  return '-';
}

export function formatReportMotivo(lead: Lead): string {
  return lead.loss_reason?.trim() || '-';
}

export function formatReportObservacao(lead: Lead): string {
  const parts: string[] = [];
  if (lead.stage === 'venda') parts.push('Venda ganha');
  if (lead.meeting_status === 'no_show') parts.push('Não compareceu');
  if (lead.meeting_status === 'reagendar') parts.push('Reagendou');
  if (lead.client_observations?.trim()) parts.push(lead.client_observations.trim());
  if (lead.manager_notes?.trim()) parts.push(lead.manager_notes.trim());
  if (parts.length === 0 && lead.history?.length) {
    const last = lead.history[0]?.note?.trim();
    if (last) parts.push(last);
  }
  return parts.length ? parts.join(' · ') : '-';
}

export function buildLeadReportRow(lead: Lead): LeadReportRow {
  return {
    lead: lead.name?.trim() || '-',
    empresa: lead.company?.trim() || '-',
    data: formatLeadActivityDate(lead),
    etapa: formatReportEtapa(lead),
    status: formatReportStatus(lead),
    motivo: formatReportMotivo(lead),
    origem: lead.utm_source?.trim() || '-',
    campanha: lead.utm_campaign?.trim() || '-',
    conjunto: lead.utm_conjunto?.trim() || '-',
    anuncio: lead.utm_medium?.trim() || '-',
    lp: extractLandingPage(lead),
    observacao: formatReportObservacao(lead),
  };
}

export function buildLeadReportRows(leads: Lead[]): LeadReportRow[] {
  return [...leads]
    .sort((a, b) => {
      const da = getLeadActivityDateIso(a) || '';
      const db = getLeadActivityDateIso(b) || '';
      if (da !== db) return da.localeCompare(db);
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    })
    .map(buildLeadReportRow);
}

export function filterLeadsByReferenceMonth(
  leads: Lead[],
  month: string,
  userId?: string | null,
): Lead[] {
  return filterLeadsForMonthlyReport(leads, month, userId);
}

export function getWeekNumberFromIso(dateIso: string): number {
  const d = new Date(`${dateIso}T12:00:00`);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((d.getTime() - start.getTime()) / 86400000 + (start.getDay() + 1) / 7);
}

/** Agrupa leads do mês por número da semana (com base na data de atividade) */
export function groupLeadsByWeek(
  monthLeads: Lead[],
  selectedMonth: string,
): { week: number; label: string; leads: Lead[] }[] {
  const [year, month] = selectedMonth.split('-').map(Number);
  const buckets = new Map<number, Lead[]>();

  monthLeads.forEach((lead) => {
    const iso = getLeadActivityDateIso(lead);
    let week = iso ? getWeekNumberFromIso(iso) : 1;
    if (iso) {
      const [y, m] = iso.split('-').map(Number);
      if (y !== year || m !== month) {
        week = 1;
      }
    }
    if (!buckets.has(week)) buckets.set(week, []);
    buckets.get(week)!.push(lead);
  });

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, leads]) => ({
      week,
      label: `Semana ${week}`,
      leads,
    }));
}

export function escapeCsvCell(value: string): string {
  const v = value.replace(/"/g, '""');
  if (/[",\n\r]/.test(v)) return `"${v}"`;
  return v;
}

export function leadReportRowsToCsv(rows: LeadReportRow[]): string {
  const header = LEAD_REPORT_COLUMNS.map((c) => c.label).join(',');
  const body = rows
    .map((row) => LEAD_REPORT_COLUMNS.map((c) => escapeCsvCell(row[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Objetos com chaves = rótulos das colunas (para Excel/JSON). */
export function leadReportRowsToRecords(rows: LeadReportRow[]): Record<string, string>[] {
  return rows.map((row) => {
    const record: Record<string, string> = {};
    LEAD_REPORT_COLUMNS.forEach((col) => {
      record[col.label] = row[col.key];
    });
    return record;
  });
}

export type WeeklyReportSection = {
  label: string;
  rows: LeadReportRow[];
};
