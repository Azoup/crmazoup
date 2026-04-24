import jsPDF from 'jspdf';
import { Lead } from '@/types/lead';
import { formatCurrency } from '@/lib/utils';
import { loadAzoupLogo } from '@/lib/quotePdf';

/**
 * Gera um PDF completo da Ficha do Cliente com todas as informações
 * cadastradas (dados pessoais, empresa, plano/valores, contratuais e observações).
 */
export async function downloadClientFichaPdf(lead: Lead): Promise<void> {
  const logoBase64 = await loadAzoupLogo();
  const doc = buildClientFichaPdf(lead, logoBase64);
  const safeName = (lead.name || 'cliente').replace(/\s+/g, '-').toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`ficha-${safeName}-${dateStr}.pdf`);
}

function buildClientFichaPdf(lead: Lead, logoBase64: string | null): jsPDF {
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
  doc.text('FICHA DO CLIENTE', pageWidth / 2, 46, { align: 'center' });

  doc.setTextColor(...medGray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitida em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 53, { align: 'center' });

  doc.setFillColor(...orange);
  doc.rect(margin, 57, contentWidth, 1.5, 'F');

  let y = 63;

  const drawSection = (title: string) => {
    y = ensureSpace(14, y);
    doc.setFillColor(...orange);
    doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, y + 6);
    y += 12;
  };

  const drawRow = (label: string, value: string | null | undefined) => {
    const text = value && String(value).trim() ? String(value) : '—';
    const valueLines = doc.splitTextToSize(text, contentWidth - 60);
    const rowH = Math.max(7, valueLines.length * 5 + 2);
    y = ensureSpace(rowH + 1, y);

    doc.setFillColor(...lightGray);
    doc.rect(margin, y, contentWidth, rowH, 'F');

    doc.setTextColor(...medGray);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), margin + 4, y + 5);

    doc.setTextColor(...darkGray);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text(valueLines, margin + 55, y + 5);

    y += rowH + 1;
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return null;
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.toLocaleDateString('pt-BR');
    } catch {
      return d;
    }
  };

  // ===== Dados Pessoais =====
  drawSection('DADOS PESSOAIS');
  drawRow('Nome', lead.name);
  drawRow('Telefone', lead.whatsapp);
  drawRow('E-mail', lead.email);
  drawRow('Data de Nascimento', fmtDate(lead.birthdate));
  drawRow('Endereço', lead.address);
  y += 3;

  // ===== Dados da Empresa =====
  drawSection('DADOS DA EMPRESA');
  drawRow('Empresa', lead.company);
  drawRow('CPF', (lead as any).cpf);
  drawRow('CNPJ', lead.cpf_cnpj);
  drawRow('Inscrição Estadual', lead.state_registration);
  drawRow('Tipo de Confecção', lead.confection_type);
  drawRow('Peças por Mês', lead.pieces_per_month ? String(lead.pieces_per_month) : null);
  drawRow('Site', lead.website);
  y += 3;

  // ===== Plano e Valores =====
  drawSection('PLANO E VALORES');
  drawRow(
    'Valor de Implantação',
    lead.implementation_value ? formatCurrency(lead.implementation_value) : null,
  );
  drawRow(
    'Mensalidade',
    lead.monthly_value ? `${formatCurrency(lead.monthly_value)} / mês` : null,
  );
  drawRow('Valor Total (Lead)', lead.value ? formatCurrency(lead.value) : null);
  y += 3;

  // ===== Dados Contratuais =====
  drawSection('DADOS CONTRATUAIS');
  drawRow('Responsável pela Implantação', lead.implementation_responsible);
  drawRow('Pessoa que Assina', lead.signer_name);
  drawRow('Cargo do Signatário', lead.signer_role);
  y += 3;

  // ===== Status no CRM =====
  drawSection('STATUS NO CRM');
  drawRow('Etapa', lead.stage);
  drawRow('Temperatura', lead.temperature);
  drawRow('Origem', lead.lead_source);
  drawRow('Data de Entrada', fmtDate(lead.entry_date));
  drawRow('Último Contato', fmtDate(lead.last_contact));
  drawRow('Próximo Contato', fmtDate(lead.next_contact));
  y += 3;

  // ===== Reunião =====
  if (lead.meeting_date || lead.meeting_pain || lead.meeting_needs || lead.meeting_link) {
    drawSection('REUNIÃO');
    drawRow('Data da Reunião', fmtDate(lead.meeting_date));
    drawRow('Link da Reunião', lead.meeting_link);
    drawRow('Dor Identificada', lead.meeting_pain);
    drawRow('Necessidades', lead.meeting_needs);
    drawRow('Status', lead.meeting_status);
    y += 3;
  }

  // ===== Observações =====
  if (lead.client_observations || lead.manager_notes) {
    drawSection('OBSERVAÇÕES');
    if (lead.client_observations) {
      const obsLines = doc.splitTextToSize(lead.client_observations, contentWidth - 8);
      const h = obsLines.length * 5 + 6;
      y = ensureSpace(h, y);
      doc.setFillColor(...lightGray);
      doc.rect(margin, y, contentWidth, h, 'F');
      doc.setTextColor(...medGray);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES DO CLIENTE', margin + 4, y + 5);
      doc.setTextColor(...darkGray);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(obsLines, margin + 4, y + 11);
      y += h + 2;
    }
    if (lead.manager_notes) {
      const notesLines = doc.splitTextToSize(lead.manager_notes, contentWidth - 8);
      const h = notesLines.length * 5 + 6;
      y = ensureSpace(h, y);
      doc.setFillColor(...lightGray);
      doc.rect(margin, y, contentWidth, h, 'F');
      doc.setTextColor(...medGray);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTAS DO GESTOR', margin + 4, y + 5);
      doc.setTextColor(...darkGray);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(notesLines, margin + 4, y + 11);
      y += h + 2;
    }
  }

  // Footer (com logo ao lado do nome — padrão do orçamento)
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
    doc.text('Ficha do cliente — documento interno.', textX, footerY + 16);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY + 16, { align: 'right' });
  }

  return doc;
}
