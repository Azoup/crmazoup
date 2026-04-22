import jsPDF from 'jspdf';
import { formatCurrency } from '@/lib/utils';

export interface QuotePdfItem {
  name: string;
  description: string;
  price: number;
  monthly_fee?: number;
  payment_type?: string;
  installments_text?: string | null;
  quantity: number;
}

export interface QuotePdfData {
  clientName: string;
  companyName?: string | null;
  phone?: string | null;
  items: QuotePdfItem[];
  notes?: string | null;
  discountPercent?: number;
  createdAt?: string | Date;
  logoBase64?: string | null;
}

/**
 * Loads the Azoup logo as a base64 JPEG. Returns null if the load fails.
 */
export async function loadAzoupLogo(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/jpeg'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/images/azoup-logo.jpeg';
  });
}

export function buildQuotePdf(data: QuotePdfData): jsPDF {
  const { clientName, companyName, phone, items, notes, discountPercent = 0, createdAt, logoBase64 } = data;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const orange: [number, number, number] = [232, 120, 12];
  const darkGray: [number, number, number] = [45, 45, 45];
  const medGray: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [240, 240, 240];
  const white: [number, number, number] = [255, 255, 255];

  const ensureSpace = (needed: number, currentY: number): number => {
    if (currentY + needed > pageHeight - 35) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  // Top bar
  doc.setFillColor(...orange);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Logo / brand
  if (logoBase64) {
    try {
      const logoW = 60;
      const logoH = 30;
      const logoX = (pageWidth - logoW) / 2;
      doc.addImage(logoBase64, 'JPEG', logoX, 8, logoW, logoH);
    } catch {
      doc.setTextColor(...orange);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('AZOUP TECNOLOGIA', pageWidth / 2, 25, { align: 'center' });
    }
  } else {
    doc.setTextColor(...orange);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('AZOUP TECNOLOGIA', pageWidth / 2, 25, { align: 'center' });
  }

  doc.setTextColor(...orange);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO COMERCIAL', pageWidth / 2, 46, { align: 'center' });

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');
  doc.setTextColor(...medGray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, pageWidth / 2, 53, { align: 'center' });

  doc.setFillColor(...orange);
  doc.rect(margin, 57, contentWidth, 1.5, 'F');

  let y = 63;

  // Client block
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');

  doc.setTextColor(...orange);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin + 6, y + 8);

  doc.setTextColor(...darkGray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clientName}`, margin + 6, y + 16);
  doc.text(`Empresa: ${companyName || '-'}`, margin + 6, y + 22);
  if (phone) doc.text(`Telefone: ${phone}`, pageWidth / 2 + 5, y + 16);
  y += 38;

  // Items
  items.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.description || '-', contentWidth - 12);
    const lineTotal = item.price * item.quantity;
    const monthlyLine = (item.monthly_fee || 0) * item.quantity;
    const hasMonthlyLine = monthlyLine > 0;
    const blockHeight = 13 + descLines.length * 4.5 + 14 + (hasMonthlyLine ? 8 : 0);
    y = ensureSpace(blockHeight + 4, y);

    doc.setFillColor(...orange);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const headerText = `${idx + 1}. ${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`;
    doc.text(headerText, margin + 6, y + 7);
    y += 13;

    doc.setTextColor(...darkGray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(descLines, margin + 6, y);
    y += descLines.length * 4.5 + 3;

    doc.setFillColor(...lightGray);
    const priceBoxH = hasMonthlyLine ? 18 : 12;
    doc.roundedRect(margin, y, contentWidth, priceBoxH, 2, 2, 'F');

    doc.setTextColor(...medGray);
    doc.setFontSize(8.5);
    doc.text('Valor', margin + 6, y + 7.5);
    doc.setTextColor(...orange);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(lineTotal), pageWidth - margin - 6, y + 7.5, { align: 'right' });

    if (hasMonthlyLine) {
      doc.setTextColor(...medGray);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Mensalidade', margin + 6, y + 14);
      doc.setTextColor(45, 130, 70);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(monthlyLine)} / mês`, pageWidth - margin - 6, y + 14, { align: 'right' });
    }
    y += priceBoxH + 2;

    if (item.payment_type === 'parcelado' && item.installments_text) {
      const condLines = doc.splitTextToSize(`Condição: ${item.installments_text}`, contentWidth - 12);
      y = ensureSpace(condLines.length * 4.5 + 3, y);
      doc.setTextColor(...medGray);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.text(condLines, margin + 6, y);
      y += condLines.length * 4.5 + 3;
      doc.setFont('helvetica', 'normal');
    }
    y += 3;
  });

  // Totals
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalMensal = items.reduce((s, i) => s + (i.monthly_fee || 0) * i.quantity, 0);
  const discountValue = Math.max(0, Math.min(100, discountPercent)) * subtotal / 100;
  const total = Math.max(0, subtotal - discountValue);
  const hasDiscount = discountValue > 0;
  const hasMonthly = totalMensal > 0;
  const totalsHeight = 12 + (hasMonthly ? 7 : 0) + (hasDiscount ? 7 : 0) + 10;

  y = ensureSpace(totalsHeight + 4, y);
  doc.setFillColor(...darkGray);
  doc.roundedRect(margin, y, contentWidth, totalsHeight, 3, 3, 'F');

  doc.setTextColor(...white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO', margin + 6, y + 8);

  let totalsY = y + 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Subtotal:', margin + 6, totalsY);
  doc.text(formatCurrency(subtotal), pageWidth - margin - 6, totalsY, { align: 'right' });
  totalsY += 6;

  if (hasDiscount) {
    doc.text(`Desconto à vista (${discountPercent}%):`, margin + 6, totalsY);
    doc.text(`- ${formatCurrency(discountValue)}`, pageWidth - margin - 6, totalsY, { align: 'right' });
    totalsY += 6;
  }

  if (hasMonthly) {
    doc.text('Mensalidade total:', margin + 6, totalsY);
    doc.text(`${formatCurrency(totalMensal)} / mês`, pageWidth - margin - 6, totalsY, { align: 'right' });
    totalsY += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...orange);
  doc.text('TOTAL', margin + 6, totalsY + 2);
  doc.text(formatCurrency(total), pageWidth - margin - 6, totalsY + 2, { align: 'right' });
  y += totalsHeight + 6;

  // Notes
  if (notes && notes.trim()) {
    const noteLines = doc.splitTextToSize(notes, contentWidth - 12);
    y = ensureSpace(14 + noteLines.length * 4.5, y);
    doc.setFillColor(...orange);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', margin + 6, y + 7);
    y += 13;
    doc.setTextColor(...darkGray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(noteLines, margin + 6, y);
    y += noteLines.length * 4.5 + 4;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 20;
    doc.setFillColor(...orange);
    doc.rect(0, footerY, pageWidth, 20, 'F');

    let textX = margin;
    if (logoBase64) {
      try {
        const fLogoH = 12;
        const fLogoW = 24;
        doc.addImage(logoBase64, 'JPEG', margin, footerY + 4, fLogoW, fLogoH);
        textX = margin + fLogoW + 4;
      } catch {
        /* ignore */
      }
    }

    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Azoup Tecnologia', textX, footerY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Orçamento válido por 15 dias a contar da data de emissão.', textX, footerY + 16);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY + 16, { align: 'right' });
  }

  return doc;
}

export function downloadQuotePdf(data: QuotePdfData): void {
  const doc = buildQuotePdf(data);
  const safeName = (data.clientName || 'cliente').replace(/\s+/g, '-').toLowerCase();
  const dateStr = data.createdAt
    ? new Date(data.createdAt).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  doc.save(`orcamento-${safeName}-${dateStr}.pdf`);
}
