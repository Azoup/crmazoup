import jsPDF from 'jspdf';
import {
  LEAD_REPORT_COLUMNS,
  LeadReportRow,
  buildLeadReportRows,
  groupLeadsByWeek,
  filterLeadsByReferenceMonth,
} from '@/lib/leadReportTable';
import { Lead } from '@/types/lead';

/** Larguras (mm) para landscape A4 — soma ~285 */
const COL_WIDTHS = [20, 22, 13, 16, 14, 18, 12, 36, 20, 28, 16, 22];
const COL_X: number[] = [];
(() => {
  let x = 6;
  COL_WIDTHS.forEach((w) => {
    COL_X.push(x);
    x += w;
  });
})();

const FONT_HEADER = 5.5;
const FONT_BODY = 5;
const ROW_PAD = 3;
const HEADER_H = 7;

function truncateToWidth(doc: jsPDF, text: string, maxW: number): string {
  const t = (text || '-').trim() || '-';
  if (doc.getTextWidth(t) <= maxW) return t;
  let s = t;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function drawTableHeader(doc: jsPDF, y: number, pageW: number): number {
  doc.setFillColor(0, 0, 0);
  doc.rect(6, y, pageW - 12, HEADER_H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONT_HEADER);
  doc.setFont('helvetica', 'bold');
  LEAD_REPORT_COLUMNS.forEach((col, i) => {
    doc.text(col.label, COL_X[i] + 1, y + 4.5);
  });
  doc.setFont('helvetica', 'normal');
  return y + HEADER_H + 2;
}

function drawTableRows(
  doc: jsPDF,
  rows: LeadReportRow[],
  startY: number,
  pageW: number,
  pageH: number,
): number {
  let y = startY;
  doc.setFontSize(FONT_BODY);

  rows.forEach((row, idx) => {
    const values = LEAD_REPORT_COLUMNS.map((c) => row[c.key]);
    const cellLines = values.map((v, i) => {
      const lines = doc.splitTextToSize(String(v || '-'), COL_WIDTHS[i] - 1);
      return lines.length ? lines : ['-'];
    });
    const lineCount = Math.max(...cellLines.map((l) => l.length));
    const rowH = Math.max(6, lineCount * 3.2 + ROW_PAD);

    if (y + rowH > pageH - 18) {
      doc.addPage('landscape');
      y = drawTableHeader(doc, 12, pageW);
    }

    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(6, y - 1, pageW - 12, rowH, 'F');
    }

    doc.setTextColor(30, 30, 30);
    cellLines.forEach((lines, i) => {
      lines.forEach((line: string, li: number) => {
        const clipped = truncateToWidth(doc, line, COL_WIDTHS[i] - 1);
        doc.text(clipped, COL_X[i], y + 2 + li * 3.2);
      });
    });
    y += rowH;
  });

  return y;
}

export function renderReportBanner(
  doc: jsPDF,
  title: string,
  subtitle: string,
  generatedAt: string,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Azoup CRM', 8, 10);
  doc.setFontSize(11);
  doc.text(title, 8, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 8, 19);
  doc.text(`Gerado em: ${generatedAt}`, pageW - 8, 19, { align: 'right' });
}

export function renderFullLeadTableSection(
  doc: jsPDF,
  sectionTitle: string,
  sectionHint: string,
  rows: LeadReportRow[],
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.addPage('landscape');
  let y = 28;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(sectionTitle, 8, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const hintLines = doc.splitTextToSize(sectionHint, pageW - 16);
  hintLines.forEach((line: string, i: number) => {
    doc.text(line, 8, y + i * 4);
  });
  y += hintLines.length * 4 + 6;

  doc.setFontSize(7);
  doc.text(`Total de leads: ${rows.length}`, 8, y);
  y += 8;

  y = drawTableHeader(doc, y, pageW);
  drawTableRows(doc, rows, y, pageW, pageH);
}

export function appendPdfFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(30, 58, 95);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(`Azoup CRM — Relatório gerado automaticamente | Página ${p}/${total}`, 8, pageH - 3);
  }
}

export function buildMonthlyFullTablePdf(
  leads: Lead[],
  selectedMonth: string,
  monthLabel: string,
  userId?: string | null,
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' });
  const monthLeads = filterLeadsByReferenceMonth(leads, selectedMonth, userId);
  const rows = buildLeadReportRows(monthLeads);

  renderReportBanner(
    doc,
    `Relatório Mensal — ${monthLabel}`,
    'Tabela completa por lead',
    new Date().toLocaleString('pt-BR'),
  );

  renderFullLeadTableSection(
    doc,
    'Tabela completa por lead',
    'Modelo para cruzar cada lead com origem, campanha, conjunto, anúncio, status comercial e resultado final.',
    rows,
  );

  appendPdfFooters(doc);
  return doc;
}

export function buildWeeklyFullTablePdf(
  leads: Lead[],
  selectedMonth: string,
  monthLabel: string,
  userId?: string | null,
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' });
  const monthLeads = filterLeadsByReferenceMonth(leads, selectedMonth, userId);
  const weeks = groupLeadsByWeek(monthLeads, selectedMonth);

  renderReportBanner(
    doc,
    `Relatório Semanal — ${monthLabel}`,
    'Tabela completa por lead (por semana)',
    new Date().toLocaleString('pt-BR'),
  );

  if (weeks.length === 0) {
    renderFullLeadTableSection(
      doc,
      'Tabela completa por lead',
      'Nenhum lead com atividade registrada neste mês.',
      [],
    );
  } else {
    weeks.forEach((w) => {
      const rows = buildLeadReportRows(w.leads);
      renderFullLeadTableSection(
        doc,
        `${w.label} — Tabela completa por lead`,
        'Modelo para cruzar cada lead com origem, campanha, conjunto, anúncio, status comercial e resultado final.',
        rows,
      );
    });
  }

  appendPdfFooters(doc);
  return doc;
}
