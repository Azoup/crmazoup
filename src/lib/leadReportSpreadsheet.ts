import * as XLSX from 'xlsx';
import {
  LEAD_REPORT_COLUMNS,
  LeadReportRow,
  WeeklyReportSection,
  leadReportRowsToRecords,
} from '@/lib/leadReportTable';

function autoColumnWidths(records: Record<string, string>[]): { wch: number }[] {
  const keys = records.length > 0 ? Object.keys(records[0]) : LEAD_REPORT_COLUMNS.map((c) => c.label);
  return keys.map((key) => ({
    wch: Math.min(
      48,
      Math.max(
        key.length + 2,
        ...records.map((r) => String(r[key] ?? '').length + 2),
      ),
    ),
  }));
}

function appendSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  records: Record<string, string>[],
): void {
  const ws = XLSX.utils.json_to_sheet(records);
  ws['!cols'] = autoColumnWidths(records);
  const safeName = sheetName.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Leads';
  XLSX.utils.book_append_sheet(wb, ws, safeName);
}

/** Planilha mensal — uma aba com todos os leads do relatório. */
export function downloadMonthlyLeadReportXlsx(
  filename: string,
  rows: LeadReportRow[],
  monthLabel: string,
): void {
  const records = leadReportRowsToRecords(rows);
  const wb = XLSX.utils.book_new();
  appendSheet(wb, 'Leads', records);

  const metaWs = XLSX.utils.aoa_to_sheet([
    ['Relatório', 'Tabela completa por lead'],
    ['Período', monthLabel],
    ['Total de leads', String(rows.length)],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
  ]);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Resumo');
  XLSX.writeFile(wb, filename);
}

/** Planilha semanal — uma aba por semana + aba consolidada. */
export function downloadWeeklyLeadReportXlsx(
  filename: string,
  sections: WeeklyReportSection[],
  monthLabel: string,
): void {
  const wb = XLSX.utils.book_new();

  const consolidated: Record<string, string>[] = [];
  sections.forEach((section) => {
    section.rows.forEach((row) => {
      const record: Record<string, string> = { Semana: section.label };
      LEAD_REPORT_COLUMNS.forEach((col) => {
        record[col.label] = row[col.key];
      });
      consolidated.push(record);
    });
    if (section.rows.length > 0) {
      appendSheet(wb, section.label, leadReportRowsToRecords(section.rows));
    }
  });

  if (consolidated.length > 0) {
    appendSheet(wb, 'Todas semanas', consolidated);
  }

  const metaWs = XLSX.utils.aoa_to_sheet([
    ['Relatório', 'Tabela completa por lead (semanal)'],
    ['Período', monthLabel],
    ['Total de leads', String(consolidated.length)],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
  ]);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Resumo');
  XLSX.writeFile(wb, filename);
}
