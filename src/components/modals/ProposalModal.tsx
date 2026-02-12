import { useState, useCallback } from 'react';
import { Lead } from '@/types/lead';
import { formatCurrency, cleanPhoneNumber } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Send, Download, Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';

interface ProposalModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

interface AzoupPlan {
  id: string;
  name: string;
  features: string[];
  hours: number;
  implementationValue: number;
  monthlyValue: number;
}

const AZOUP_PLANS: AzoupPlan[] = [
  {
    id: 'basic',
    name: 'PLANO BASIC',
    features: [
      'PCP (Produção Básico)',
      'Emissão de NF-e',
      'Relatórios Gerenciais',
      'Carteira de Pedidos',
      '  • Romaneio de Pedidos',
      'Controle Financeiro',
      '  • Contas à pagar e receber',
      'Controle de Estoque',
      '  • Somente Produto acabado',
      'B.I Vendas e Produção',
    ],
    hours: 30,
    implementationValue: 3900,
    monthlyValue: 550,
  },
  {
    id: 'pro',
    name: 'PLANO PRÓ',
    features: [
      'PCP (Produção Completo)',
      'Emissão de NF-e',
      'Relatórios Gerenciais',
      'Carteira de Pedidos',
      '  • Romaneio de Pedidos',
      'Controle Financeiro',
      '  • Contas à pagar e receber',
      '  • Fluxo de caixa',
      '  • DRE',
      'Controle de Estoque',
      '  • Matéria Prima e Produto acabado',
      'B.I Vendas e Produção',
      'Ficha Técnica',
      'Pagamento de Faccionistas',
      'Emissão de Boletos',
    ],
    hours: 50,
    implementationValue: 6500,
    monthlyValue: 650,
  },
  {
    id: 'master',
    name: 'PLANO MASTER',
    features: [
      'PCP (Produção Completo)',
      'Emissão de NF-e',
      'Relatórios Gerenciais',
      'Carteira de Pedidos',
      '  • Romaneio de Pedidos',
      'Controle Financeiro',
      '  • Contas à pagar e receber',
      '  • Fluxo de caixa',
      '  • DRE',
      'Controle de Estoque',
      '  • Matéria Prima e Produto acabado',
      'B.I Vendas e Produção',
      'Ficha Técnica',
      'Pagamento de Faccionistas',
      'Emissão de Boletos',
      'Integração com E-commerce',
      'Integração com Correios',
      'App Vendas Mobile',
    ],
    hours: 70,
    implementationValue: 8950,
    monthlyValue: 850,
  },
];

interface SelectedPlanConfig {
  planId: string;
  customImplementation: string;
  customMonthly: string;
  customHours: string;
}

export function ProposalModal({ lead, open, onClose }: ProposalModalProps) {
  const [selectedPlans, setSelectedPlans] = useState<SelectedPlanConfig[]>([
    { planId: '', customImplementation: '', customMonthly: '', customHours: '' },
  ]);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [responsibleName, setResponsibleName] = useState('Samuel Fernandes');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [discount, setDiscount] = useState('');

  const addPlanSlot = () => {
    setSelectedPlans(prev => [...prev, { planId: '', customImplementation: '', customMonthly: '', customHours: '' }]);
  };

  const removePlanSlot = (index: number) => {
    setSelectedPlans(prev => prev.filter((_, i) => i !== index));
  };

  const updatePlanSlot = (index: number, field: keyof SelectedPlanConfig, value: string) => {
    setSelectedPlans(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const selectPlan = (index: number, planId: string) => {
    const plan = AZOUP_PLANS.find(p => p.id === planId);
    if (plan) {
      setSelectedPlans(prev => prev.map((p, i) => i === index ? {
        planId,
        customImplementation: plan.implementationValue.toString(),
        customMonthly: plan.monthlyValue.toString(),
        customHours: plan.hours.toString(),
      } : p));
    }
  };

  const getActivePlans = () => {
    return selectedPlans
      .filter(sp => sp.planId)
      .map(sp => {
        const basePlan = AZOUP_PLANS.find(p => p.id === sp.planId)!;
        return {
          ...basePlan,
          implementationValue: Number(sp.customImplementation) || basePlan.implementationValue,
          monthlyValue: Number(sp.customMonthly) || basePlan.monthlyValue,
          hours: Number(sp.customHours) || basePlan.hours,
        };
      });
  };

  const generatePDF = useCallback(() => {
    if (!lead) return;

    const plans = getActivePlans();
    if (plans.length === 0) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const orange = [232, 120, 12] as [number, number, number];
    const darkOrange = [200, 100, 10] as [number, number, number];
    const darkGray = [45, 45, 45] as [number, number, number];
    const medGray = [100, 100, 100] as [number, number, number];
    const lightGray = [240, 240, 240] as [number, number, number];
    const white = [255, 255, 255] as [number, number, number];

    // --- HEADER ---
    doc.setFillColor(...orange);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Decorative stripe
    doc.setFillColor(...darkOrange);
    doc.rect(0, 42, pageWidth, 3, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('AZOUP', margin, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('TECNOLOGIA', margin, 30);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPOSTA COMERCIAL', pageWidth - margin, 22, { align: 'right' });

    const today = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(today, pageWidth - margin, 32, { align: 'right' });

    let y = 55;

    // --- CLIENT INFO ---
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');

    doc.setTextColor(...orange);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', margin + 6, y + 8);

    doc.setTextColor(...darkGray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${lead.name}`, margin + 6, y + 16);
    doc.text(`Empresa: ${lead.company || '-'}`, margin + 6, y + 22);
    doc.text(`Segmento: ${lead.confection_type || '-'}`, pageWidth / 2 + 5, y + 16);
    doc.text(`Contato: ${lead.whatsapp || lead.email || '-'}`, pageWidth / 2 + 5, y + 22);

    y += 38;

    // --- PLANS ---
    plans.forEach((plan, idx) => {
      // Check if we need a new page
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 20;
      }

      // Plan header
      doc.setFillColor(...orange);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(plan.name, margin + 6, y + 7);
      y += 14;

      // Features
      doc.setTextColor(...darkGray);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');

      plan.features.forEach(feature => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        const isSubItem = feature.startsWith('  •');
        const xPos = margin + (isSubItem ? 14 : 6);
        if (!isSubItem) {
          doc.setFont('helvetica', 'bold');
          doc.text('✓', margin + 6, y);
          doc.setFont('helvetica', 'normal');
          doc.text(feature, margin + 12, y);
        } else {
          doc.text(feature, xPos, y);
        }
        y += 5;
      });

      y += 3;

      // Hours + Values box
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...orange);
      doc.text(`${plan.hours} Horas de Consultoria/Treinamento`, margin + 6, y + 7);

      doc.setTextColor(...darkGray);
      doc.setFontSize(10);
      doc.text(`Implantação: ${formatCurrency(plan.implementationValue)}`, margin + 6, y + 15);
      doc.setTextColor(...orange);
      doc.text(`Mensalidade: ${formatCurrency(plan.monthlyValue)}`, pageWidth / 2, y + 15);

      y += 28;
    });

    // --- PAYMENT TERMS ---
    if (paymentTerms.trim()) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor(...orange);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CONDIÇÕES DE PAGAMENTO', margin + 6, y + 7);
      y += 14;

      doc.setTextColor(...darkGray);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const paymentLines = doc.splitTextToSize(paymentTerms, contentWidth - 12);
      doc.text(paymentLines, margin + 6, y);
      y += paymentLines.length * 5 + 6;
    }

    // --- ADDITIONAL NOTES ---
    if (additionalNotes.trim()) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(...medGray);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const noteLines = doc.splitTextToSize(additionalNotes, contentWidth - 12);
      doc.text(noteLines, margin + 6, y);
      y += noteLines.length * 4 + 8;
    }

    // --- DISCOUNT ---
    if (discount.trim()) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(34, 139, 34);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`DESCONTO: ${discount}`, pageWidth / 2, y + 7, { align: 'center' });
      y += 16;
    }

    // --- FOOTER ---
    const footerY = pageHeight - 25;
    doc.setFillColor(...orange);
    doc.rect(0, footerY, pageWidth, 25, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Azoup Tecnologia', margin, footerY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Responsável: ${responsibleName}`, margin, footerY + 14);
    doc.text('Proposta válida por 15 dias', pageWidth - margin, footerY + 14, { align: 'right' });

    return doc;
  }, [lead, selectedPlans, paymentTerms, responsibleName, additionalNotes, discount]);

  const handleDownloadPDF = () => {
    const doc = generatePDF();
    if (doc && lead) {
      doc.save(`proposta-${lead.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  const handleSendWhatsApp = () => {
    if (!lead?.whatsapp) return;
    const phone = cleanPhoneNumber(lead.whatsapp);
    const plans = getActivePlans();
    const planNames = plans.map(p => p.name).join(', ');
    const totalImpl = plans.reduce((a, p) => a + p.implementationValue, 0);
    const totalMonthly = plans.reduce((a, p) => a + p.monthlyValue, 0);

    const message = encodeURIComponent(
      `Olá ${lead.name}! 😊\n\nSegue a proposta comercial da *Azoup Tecnologia*:\n\n` +
      `📋 *${planNames}*\n` +
      `💰 Implantação: ${formatCurrency(totalImpl)}\n` +
      `📅 Mensalidade: ${formatCurrency(totalMonthly)}\n` +
      (paymentTerms ? `\n💳 *Pagamento:* ${paymentTerms}\n` : '') +
      `\nO PDF completo será enviado em seguida.\n\n` +
      `Att, ${responsibleName}\nAzoup Tecnologia`
    );

    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <FileText size={20} />
            Gerar Proposta — {lead.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Plan Selection */}
          {selectedPlans.map((sp, idx) => {
            const plan = AZOUP_PLANS.find(p => p.id === sp.planId);
            return (
              <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-sm">Plano {idx + 1}</Label>
                  {selectedPlans.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removePlanSlot(idx)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  )}
                </div>

                <Select value={sp.planId} onValueChange={(v) => selectPlan(idx, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {AZOUP_PLANS.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {sp.planId && (
                  <>
                    {plan && (
                      <div className="bg-muted p-3 rounded-lg text-xs space-y-1 max-h-32 overflow-y-auto">
                        {plan.features.map((f, i) => (
                          <div key={i} className={f.startsWith('  •') ? 'pl-4 text-muted-foreground' : 'font-medium'}>
                            {f.startsWith('  •') ? f : `✓ ${f}`}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Implantação (R$)</Label>
                        <Input
                          type="number"
                          value={sp.customImplementation}
                          onChange={(e) => updatePlanSlot(idx, 'customImplementation', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Mensalidade (R$)</Label>
                        <Input
                          type="number"
                          value={sp.customMonthly}
                          onChange={(e) => updatePlanSlot(idx, 'customMonthly', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Horas</Label>
                        <Input
                          type="number"
                          value={sp.customHours}
                          onChange={(e) => updatePlanSlot(idx, 'customHours', e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <Button variant="outline" size="sm" onClick={addPlanSlot} className="gap-2 w-full">
            <Plus size={14} /> Adicionar outro plano
          </Button>

          {/* Payment Terms */}
          <div>
            <Label className="text-sm font-bold">Forma de Pagamento</Label>
            <Textarea
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Ex: 3x no cartão, à vista com 10% de desconto..."
              rows={2}
            />
          </div>

          {/* Discount */}
          <div>
            <Label className="text-sm font-bold">Desconto (opcional)</Label>
            <Input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="Ex: 10% para pagamento à vista"
            />
          </div>

          {/* Responsible */}
          <div>
            <Label className="text-sm font-bold">Responsável</Label>
            <Input
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
            />
          </div>

          {/* Additional Notes */}
          <div>
            <Label className="text-sm font-bold">Observações adicionais</Label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Notas extras para a proposta..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleDownloadPDF} className="flex-1 gap-2" disabled={!getActivePlans().length}>
              <Download size={16} /> Baixar PDF
            </Button>
            <Button
              onClick={() => { handleDownloadPDF(); handleSendWhatsApp(); }}
              variant="outline"
              className="flex-1 gap-2 border-green-500 text-green-600 hover:bg-green-50"
              disabled={!lead.whatsapp || !getActivePlans().length}
            >
              <Send size={16} /> Enviar via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
