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
import { FileText, Download, Send, Plus, Trash2, Package, Phone } from 'lucide-react';
import jsPDF from 'jspdf';
import type { Product } from '@/components/manager/ProductsManager';

interface ManualQuoteModalProps {
  open: boolean;
  onClose: () => void;
  leads?: Lead[];
  prefillLead?: Lead | null;
}

interface QuoteItem {
  productId: string;
  name: string;
  description: string;
  price: number;
  payment_type: string;
  installments: number | null;
  quantity: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  unico: 'Pagamento Único',
  mensal: 'Mensal',
  parcelado: 'Parcelado',
};

export function ManualQuoteModal({ open, onClose, leads = [], prefillLead }: ManualQuoteModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedLeadId, setLinkedLeadId] = useState<string>('none');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState('');
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

  const addProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => [...prev, {
      productId: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      payment_type: product.payment_type,
      installments: product.installments,
      quantity: 1,
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuantity = (idx: number, qty: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, qty) } : it));
  };

  const total = useMemo(() => items.reduce((sum, it) => sum + it.price * it.quantity, 0), [items]);
  const totalMensal = useMemo(
    () => items.filter(i => i.payment_type === 'mensal').reduce((s, i) => s + i.price * i.quantity, 0),
    [items],
  );
  const totalUnico = useMemo(
    () => items.filter(i => i.payment_type !== 'mensal').reduce((s, i) => s + i.price * i.quantity, 0),
    [items],
  );

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

    // Items section
    items.forEach((item, idx) => {
      const descLines = doc.splitTextToSize(item.description || '-', contentWidth - 12);
      const blockHeight = 14 + descLines.length * 4.5 + 14;
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

      // Price block
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
      const priceLabel = `${PAYMENT_LABELS[item.payment_type] || item.payment_type}${
        item.payment_type === 'parcelado' && item.installments ? ` em ${item.installments}x` : ''
      }`;
      doc.setTextColor(...medGray);
      doc.setFontSize(8.5);
      doc.text(priceLabel, margin + 6, y + 7.5);
      doc.setTextColor(...orange);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const lineTotal = item.price * item.quantity;
      doc.text(formatCurrency(lineTotal), pageWidth - margin - 6, y + 7.5, { align: 'right' });
      y += 17;
    });

    // Totals box
    y = ensureSpace(40, y);
    doc.setFillColor(...darkGray);
    doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO FINANCEIRO', margin + 6, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (totalUnico > 0) {
      doc.text(`Pagamento único / parcelado:`, margin + 6, y + 16);
      doc.text(formatCurrency(totalUnico), pageWidth - margin - 6, y + 16, { align: 'right' });
    }
    if (totalMensal > 0) {
      doc.text(`Mensalidades:`, margin + 6, y + 22);
      doc.text(formatCurrency(totalMensal), pageWidth - margin - 6, y + 22, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...orange);
    doc.text('TOTAL', margin + 6, y + 29);
    doc.text(formatCurrency(total), pageWidth - margin - 6, y + 29, { align: 'right' });
    y += 38;

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

    // Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const footerY = pageHeight - 20;
      doc.setFillColor(...orange);
      doc.rect(0, footerY, pageWidth, 20, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Azoup Tecnologia', margin, footerY + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Orçamento válido por 15 dias a contar da data de emissão.', margin, footerY + 13);
      doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY + 13, { align: 'right' });
    }

    return doc;
  };

  const persistQuote = async () => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      lead_id: linkedLeadId !== 'none' ? linkedLeadId : null,
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
          {/* Optional lead link */}
          {leads.length > 0 && (
            <div>
              <Label className="text-sm font-bold">Vincular a lead existente (opcional)</Label>
              <Select value={linkedLeadId} onValueChange={handleLeadSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lead..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo (orçamento avulso)</SelectItem>
                  {leads.slice(0, 100).map(lead => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name} {lead.company ? `— ${lead.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      {p.name} — {formatCurrency(p.price)} ({PAYMENT_LABELS[p.payment_type]})
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
                          {formatCurrency(item.price)} / un · {PAYMENT_LABELS[item.payment_type]}
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
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="font-bold text-foreground">Total Geral</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
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
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleDownload}
              disabled={items.length === 0 || saving}
              className="flex-1 gap-2"
            >
              <Download size={16} /> Baixar PDF
            </Button>
            <Button
              onClick={handleSendWhatsapp}
              disabled={items.length === 0 || !phone.trim() || saving}
              variant="outline"
              className="flex-1 gap-2 border-green-500 text-green-600 hover:bg-green-50"
            >
              <Send size={16} /> Enviar via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
