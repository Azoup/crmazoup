import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanPhoneNumber } from '@/lib/utils';
import { Lead } from '@/types/lead';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Download, Send, Trash2, Package, Phone, Save, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import type { Product } from '@/components/manager/ProductsManager';

interface ManualQuoteModalProps {
  open: boolean;
  onClose: () => void;
  leads?: Lead[];
  prefillLead?: Lead | null;
  onQuoteSaved?: () => void;
}

interface QuoteItem {
  productId: string;
  name: string;
  description: string;
  price: number;
  monthly_fee: number;
  payment_type: string;
  installments: number | null;
  installments_text: string | null;
  quantity: number;
}

export function ManualQuoteModal({ open, onClose, leads = [], prefillLead, onQuoteSaved }: ManualQuoteModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedLeadId, setLinkedLeadId] = useState<string>('none');
  const [leadSearch, setLeadSearch] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState('');
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load products
  useEffect(() => {
    if (!open) return;
    setLoadingProducts(true);
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) setProducts(data as Product[]);
        setLoadingProducts(false);
      });
  }, [open]);

  // Prefill from lead if provided
  useEffect(() => {
    if (open && prefillLead) {
      setClientName(prefillLead.name || '');
      setCompanyName(prefillLead.company || '');
      setPhone(prefillLead.whatsapp || '');
      setLinkedLeadId(prefillLead.id);
    } else if (open && !prefillLead) {
      setClientName('');
      setCompanyName('');
      setPhone('');
      setLinkedLeadId('none');
      setItems([]);
      setNotes('');
      setDiscountPercent('');
      setLeadSearch('');
    }
  }, [open, prefillLead]);

  // Load logo
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL('image/jpeg'));
      }
    };
    img.src = '/images/azoup-logo.jpeg';
  }, []);

  const handleLeadSelect = (leadId: string) => {
    setLinkedLeadId(leadId);
    if (leadId === 'none') return;
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setClientName(lead.name || '');
      setCompanyName(lead.company || '');
      setPhone(lead.whatsapp || '');
    }
  };

  const filteredLeadOptions = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    const list = q
      ? leads.filter(l =>
          l.name.toLowerCase().includes(q) ||
          (l.company || '').toLowerCase().includes(q) ||
          (l.whatsapp || '').includes(q),
        )
      : leads;
    return list.slice(0, 50);
  }, [leads, leadSearch]);

  const addProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => [...prev, {
      productId: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      monthly_fee: product.monthly_fee || 0,
      payment_type: product.payment_type,
      installments: product.installments,
      installments_text: product.installments_text,
      quantity: 1,
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuantity = (idx: number, qty: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, qty) } : it));
  };

  const updateItemInstallmentsText = (idx: number, text: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, installments_text: text } : it));
  };

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + it.price * it.quantity, 0), [items]);
  const totalMensal = useMemo(
    () => items.reduce((s, i) => s + (i.monthly_fee || 0) * i.quantity, 0),
    [items],
  );
  const discountValue = useMemo(() => {
    const pct = Number(discountPercent) || 0;
    return Math.max(0, Math.min(100, pct)) * subtotal / 100;
  }, [discountPercent, subtotal]);
  const total = useMemo(() => Math.max(0, subtotal - discountValue), [subtotal, discountValue]);

  const openWhatsapp = () => {
    if (!phone.trim()) return;
    const cleaned = cleanPhoneNumber(phone);
    window.open(`https://wa.me/${cleaned}`, '_blank');
  };

  const generatePDF = (): jsPDF | null => {
    if (items.length === 0) {
      toast({ title: 'Adicione ao menos um produto', variant: 'destructive' });
      return null;
    }
    if (!clientName.trim()) {
      toast({ title: 'Nome do cliente é obrigatório', variant: 'destructive' });
      return null;
    }

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

    const today = new Date().toLocaleDateString('pt-BR');
    doc.setTextColor(...medGray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(today, pageWidth / 2, 53, { align: 'center' });

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

    // Items section — NO payment-type label per item, NO "em Xx"
    items.forEach((item, idx) => {
      const descLines = doc.splitTextToSize(item.description || '-', contentWidth - 12);
      const lineTotal = item.price * item.quantity;
      const monthlyLine = item.monthly_fee * item.quantity;
      const hasMonthly = monthlyLine > 0;
      const blockHeight = 13 + descLines.length * 4.5 + 14 + (hasMonthly ? 8 : 0);
      y = ensureSpace(blockHeight + 4, y);

      // Header
      doc.setFillColor(...orange);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const headerText = `${idx + 1}. ${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`;
      doc.text(headerText, margin + 6, y + 7);
      y += 13;

      // Description (full, no truncation)
      doc.setTextColor(...darkGray);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(descLines, margin + 6, y);
      y += descLines.length * 4.5 + 3;

      // Price block — only value, no payment label
      doc.setFillColor(...lightGray);
      const priceBoxH = hasMonthly ? 18 : 12;
      doc.roundedRect(margin, y, contentWidth, priceBoxH, 2, 2, 'F');

      doc.setTextColor(...medGray);
      doc.setFontSize(8.5);
      doc.text('Valor', margin + 6, y + 7.5);
      doc.setTextColor(...orange);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(lineTotal), pageWidth - margin - 6, y + 7.5, { align: 'right' });

      if (hasMonthly) {
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

      // Installments custom text (if any) — only condition shown
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

    // Totals box
    const hasDiscount = discountValue > 0;
    const totalsHeight = 12 + (hasMonthly() ? 7 : 0) + (hasDiscount ? 7 : 0) + 10;
    function hasMonthly() { return totalMensal > 0; }

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

    if (totalMensal > 0) {
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
    if (notes.trim()) {
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

    // Footer on every page — logo + name
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const footerY = pageHeight - 20;
      doc.setFillColor(...orange);
      doc.rect(0, footerY, pageWidth, 20, 'F');

      // Logo on the left of the footer
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
  };

  const persistQuote = async (createdLeadId?: string) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      lead_id: createdLeadId || (linkedLeadId !== 'none' ? linkedLeadId : null),
      client_name: clientName.trim(),
      company_name: companyName.trim() || null,
      phone: phone.trim() || null,
      items: items as any,
      total,
      notes: notes.trim() || null,
    };
    const { error } = await supabase.from('manual_quotes').insert(payload);
    if (error) console.error('Error saving manual quote:', error);
  };

  // Create a Lead in 'proposta' stage with lead_source='orcamento_manual'
  const createLeadFromQuote = async (): Promise<string | null> => {
    if (!user) return null;
    const itemsSummary = items
      .map(i => `• ${i.name} (x${i.quantity}) — ${formatCurrency(i.price * i.quantity)}`)
      .join('\n');
    const observations =
      `Orçamento manual gerado em ${new Date().toLocaleString('pt-BR')}\n` +
      `Total: ${formatCurrency(total)}\n` +
      (totalMensal > 0 ? `Mensalidade: ${formatCurrency(totalMensal)}/mês\n` : '') +
      (discountValue > 0 ? `Desconto à vista: ${discountPercent}% (${formatCurrency(discountValue)})\n` : '') +
      `\nItens:\n${itemsSummary}` +
      (notes.trim() ? `\n\nObservações: ${notes.trim()}` : '');

    const history = [{
      type: 'orcamento_manual',
      note: `Orçamento manual criado — total ${formatCurrency(total)}`,
      date: new Date().toISOString(),
      user: 'Gestor',
    }];

    const { data, error } = await supabase
      .from('leads')
      .insert({
        user_id: user.id,
        name: clientName.trim(),
        company: companyName.trim() || null,
        whatsapp: phone.trim() || null,
        stage: 'proposta',
        lead_source: 'orcamento_manual',
        temperature: 'morno',
        implementation_value: subtotal - discountValue,
        monthly_value: totalMensal,
        value: total,
        client_observations: observations,
        history: history as any,
        last_contact: new Date().toISOString(),
        entry_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead from quote:', error);
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
      return null;
    }
    return data?.id || null;
  };

  const handleSaveQuoteAsLead = async () => {
    if (items.length === 0) {
      toast({ title: 'Adicione ao menos um produto', variant: 'destructive' });
      return;
    }
    if (!clientName.trim()) {
      toast({ title: 'Nome do cliente é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    let leadIdToLink = linkedLeadId !== 'none' ? linkedLeadId : null;
    if (!leadIdToLink) {
      leadIdToLink = await createLeadFromQuote();
      if (!leadIdToLink) {
        setSaving(false);
        return;
      }
    }
    await persistQuote(leadIdToLink);
    setSaving(false);
    toast({
      title: 'Orçamento salvo',
      description: 'Card criado em Proposta como "Orçamento Manual".',
    });
    onQuoteSaved?.();
    onClose();
  };

  const handleDownload = async () => {
    const doc = generatePDF();
    if (!doc) return;
    setSaving(true);
    const safeName = clientName.replace(/\s+/g, '-').toLowerCase();
    doc.save(`orcamento-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`);
    await persistQuote();
    setSaving(false);
    toast({ title: 'Orçamento gerado', description: 'PDF baixado e registrado com sucesso.' });
  };

  const handleSendWhatsapp = async () => {
    const doc = generatePDF();
    if (!doc) return;
    if (!phone.trim()) {
      toast({ title: 'Telefone obrigatório para enviar via WhatsApp', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const safeName = clientName.replace(/\s+/g, '-').toLowerCase();
    doc.save(`orcamento-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`);
    await persistQuote();

    const cleaned = cleanPhoneNumber(phone);
    const message = encodeURIComponent(
      `Olá ${clientName}! Segue o orçamento da Azoup Tecnologia.\n\n` +
      `Total: ${formatCurrency(total)}\n\n` +
      `O PDF detalhado será enviado em seguida.`,
    );
    window.open(`https://wa.me/${cleaned}?text=${message}`, '_blank');
    setSaving(false);
    toast({ title: 'Orçamento enviado', description: 'PDF baixado e WhatsApp aberto.' });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <FileText size={20} /> Novo Orçamento Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Optional lead link with search */}
          {leads.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-bold">Vincular a lead existente (opcional)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-muted-foreground/60" size={14} />
                <Input
                  placeholder="Buscar lead por nome, empresa ou telefone..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={linkedLeadId} onValueChange={handleLeadSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lead..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo (criar novo card)</SelectItem>
                  {filteredLeadOptions.map(lead => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name} {lead.company ? `— ${lead.company}` : ''} {lead.whatsapp ? `· ${lead.whatsapp}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {leadSearch && filteredLeadOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum lead encontrado.</p>
              )}
            </div>
          )}

          {/* Client info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-bold">Nome do Cliente *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-bold">Nome da Empresa</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-bold">Telefone (WhatsApp)</Label>
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 11 99999-9999"
              />
              <Button
                type="button"
                variant="outline"
                onClick={openWhatsapp}
                disabled={!phone.trim()}
                className="gap-2 shrink-0"
              >
                <Phone size={14} /> Abrir
              </Button>
            </div>
          </div>

          {/* Product picker */}
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="font-bold flex items-center gap-2">
                <Package size={14} /> Produtos do Orçamento
              </Label>
            </div>

            <Select value="" onValueChange={addProduct}>
              <SelectTrigger>
                <SelectValue placeholder={loadingProducts ? 'Carregando...' : 'Adicionar produto do catálogo...'} />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    Nenhum produto cadastrado
                  </div>
                ) : (
                  products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)}
                      {p.monthly_fee > 0 ? ` + ${formatCurrency(p.monthly_fee)}/mês` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum produto adicionado ao orçamento ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words mt-1">
                          {item.description}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        className="text-destructive shrink-0"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>

                    {item.payment_type === 'parcelado' && (
                      <div>
                        <Label className="text-xs font-medium">Condição de parcelamento</Label>
                        <Input
                          value={item.installments_text || ''}
                          onChange={(e) => updateItemInstallmentsText(idx, e.target.value)}
                          placeholder="Ex: entrada via Pix + 30/60/90 dias"
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Qtd:</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(item.price)} / un
                          {item.monthly_fee > 0 ? ` + ${formatCurrency(item.monthly_fee)}/mês` : ''}
                        </span>
                      </div>
                      <p className="font-bold text-primary">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-sm font-semibold">{formatCurrency(subtotal)}</span>
                </div>

                {/* Discount field */}
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-bold whitespace-nowrap">Desconto à vista (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="0"
                      className="w-24 h-8 text-right"
                    />
                    <span className="text-xs text-muted-foreground">
                      {discountValue > 0 ? `- ${formatCurrency(discountValue)}` : ''}
                    </span>
                  </div>
                </div>

                {totalMensal > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Mensalidade total</span>
                    <span className="text-sm font-semibold text-success">
                      {formatCurrency(totalMensal)}/mês
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-bold">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condições, prazos, observações adicionais..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={handleDownload}
              disabled={items.length === 0 || saving}
              variant="outline"
              className="flex-1 min-w-[150px] gap-2"
            >
              <Download size={16} /> Baixar PDF
            </Button>
            <Button
              onClick={handleSendWhatsapp}
              disabled={items.length === 0 || !phone.trim() || saving}
              variant="outline"
              className="flex-1 min-w-[150px] gap-2 border-green-500 text-green-600 hover:bg-green-50"
            >
              <Send size={16} /> Enviar via WhatsApp
            </Button>
            <Button
              onClick={handleSaveQuoteAsLead}
              disabled={items.length === 0 || saving}
              className="flex-1 min-w-[180px] gap-2"
            >
              <Save size={16} /> Salvar Orçamento
            </Button>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            "Salvar Orçamento" cria um card na coluna <strong>Proposta</strong> do pipeline do gestor com status <strong>Orçamento Manual</strong>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
