import jsPDF from 'jspdf';
import { Lead } from '@/types/lead';
import { formatCurrency } from '@/lib/utils';
import { loadAzoupLogo } from '@/lib/quotePdf';

// Mesma lista de planos usada no formulário da Ficha (ClientInfoForm).
// Inferimos o plano selecionado a partir dos valores salvos no lead para
// imprimir nome + módulos no PDF, sem precisar de coluna nova no banco.
const PLANS = [
  {
    id: 'basic',
    name: 'Plano Basic',
    monthly: 400,
    implementation: 2500,
    hours: 30,
    modules: [
      'PCP (Produção)', 'Ficha Técnica', 'Emissão de NF-e', 'Relatórios Gerenciais',
      'Carteira de Pedidos', 'Controle Financeiro', 'Controle de Estoque', 'Relatórios B.I.',
    ],
  },
  {
    id: 'pro',
    name: 'Plano Pró ERP Confecção',
    monthly: 500,
    implementation: 3500,
    hours: 50,
    modules: [
      'PCP (Produção)', 'Ficha Técnica', 'Ficha de Custos', 'Emissão de NF-e',
      'Relatórios Gerenciais', 'Carteira de Pedidos + Romaneio',
      'Controle Financeiro + Contas a pagar/receber',
      'Controle de Estoque + Matéria-prima e produto acabado', 'Boletos',
      'Power B.I - Padrão e Produção',
    ],
  },
  {
    id: 'master',
    name: 'Plano Master ERP Confecção',
    monthly: 650,
    implementation: 6500,
    hours: 70,
    modules: [
      'PCP (Produção)', 'Ficha Técnica', 'Ficha de Custos',
      'Integração com E-commerce', 'Integração com Correios', 'Emissão de NF-e',
      'Relatórios Gerenciais', 'Carteira de Pedidos + Romaneio',
      'Controle Financeiro + Contas a pagar/receber',
      'Controle de Estoque + Matéria-prima e produto acabado', 'Boletos',
      'Power B.I Padrão e Produção',
    ],
  },
];

function detectPlan(lead: Lead) {
  const impl = Number(lead.implementation_value || 0);
  const monthly = Number(lead.monthly_value || 0);
  // Match exato por implantação + mensalidade
  let plan = PLANS.find(p => p.implementation === impl && p.monthly === monthly);
  if (plan) return plan;
  // Fallback: por implantação
  plan = PLANS.find(p => p.implementation === impl);
  if (plan) return plan;
  // Fallback: por mensalidade
  plan = PLANS.find(p => p.monthly === monthly);
  return plan || null;
}

/**
 * Gera um PDF completo da Ficha do Cliente com a mesma estrutura
 * exibida na ficha preenchida pelo gestor.
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

  // ===== Dados da Empresa =====
  drawSection('DADOS DA EMPRESA');
  drawRow('Nome da Empresa', lead.company);
  drawRow('E-mail da Empresa', (lead as any).signer_email || lead.email);
  drawRow('CNPJ', lead.cpf_cnpj);
  drawRow('Inscrição Estadual', lead.state_registration);
  drawRow('Tipo de Confecção', lead.confection_type);
  drawRow('Peças por Mês', lead.pieces_per_month ? String(lead.pieces_per_month) : null);
  drawRow('Site', lead.website);
  y += 3;

  // ===== Dados da Pessoa que Assina =====
  drawSection('DADOS DA PESSOA QUE ASSINA PELA EMPRESA');
  drawRow('Nome Completo', lead.signer_name || lead.name);
  drawRow('Data de Nascimento', fmtDate(lead.birthdate));
  drawRow('CPF', (lead as any).cpf);
  drawRow('Telefone', (lead as any).signer_phone || lead.whatsapp);
  drawRow('E-mail', (lead as any).signer_email || lead.email);
  drawRow('Endereço', lead.address);
  y += 3;

  // ===== Plano e Valores =====
  const plan = detectPlan(lead);
  drawSection('PLANO E VALORES');
  drawRow('Plano Selecionado', plan ? plan.name : '—');
  if (plan) {
    drawRow('Horas de Implantação', `${plan.hours}h`);
  }
  drawRow(
    'Valor de Implantação',
    lead.implementation_value ? formatCurrency(lead.implementation_value) : null,
  );
  drawRow(
    'Mensalidade',
    lead.monthly_value ? `${formatCurrency(lead.monthly_value)} / mês` : null,
  );

  // Módulos do plano (se identificado)
  if (plan && plan.modules.length) {
    y += 1;
    y = ensureSpace(10, y);
    doc.setTextColor(...medGray);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('MÓDULOS INCLUSOS', margin + 4, y + 4);
    y += 7;

    // Lista de módulos como "chips" simples em grid
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);

    const colW = (contentWidth - 4) / 2;
    let col = 0;
    let rowStartY = y;
    plan.modules.forEach((mod) => {
      const xPos = margin + (col * (colW + 4));
      const lines = doc.splitTextToSize(`• ${mod}`, colW - 4);
      const h = lines.length * 4.5 + 2;
      // Quebra de página se necessário
      if (rowStartY + h > pageHeight - 35) {
        doc.addPage();
        y = 20;
        rowStartY = y;
        col = 0;
      }
      doc.setFillColor(...lightGray);
      doc.rect(xPos, rowStartY, colW, h, 'F');
      doc.text(lines, xPos + 2, rowStartY + 4.5);

      if (col === 0) {
        col = 1;
      } else {
        col = 0;
        rowStartY += h + 1;
      }
    });
    y = col === 1 ? rowStartY + 8 : rowStartY + 2;
  }

  y += 3;

  // ===== Responsável pela Implantação =====
  drawSection('RESPONSÁVEL PELA IMPLANTAÇÃO');
  drawRow('Responsável pela Implantação', lead.implementation_responsible);
  drawRow('Telefone do Responsável', (lead as any).implementation_responsible_phone);
  y += 3;

  // ===== Reunião =====
  if (lead.meeting_date || lead.meeting_pain || lead.meeting_needs || lead.meeting_link) {
    drawSection('REUNIÃO');
    drawRow('Data da Reunião', fmtDate(lead.meeting_date));
    drawRow('Link da Reunião', lead.meeting_link);
    drawRow('Dor Identificada', lead.meeting_pain);
    drawRow('Necessidades', lead.meeting_needs);
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
