import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Receipt, Download, RefreshCw } from 'lucide-react';
import { buildQuotePdf, loadAzoupLogo, type QuotePdfItem } from '@/lib/quotePdf';

interface QuoteRow {
  id: string;
  client_name: string;
  company_name: string | null;
  phone: string | null;
  items: QuotePdfItem[];
  total: number;
  notes: string | null;
  created_at: string;
}

interface ClientQuotesListProps {
  leadId: string;
  refreshKey?: number;
}

export function ClientQuotesList({ leadId, refreshKey = 0 }: ClientQuotesListProps) {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const fetchQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('manual_quotes')
      .select('id, client_name, company_name, phone, items, total, notes, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching quotes:', error);
    } else if (data) {
      setQuotes(
        data.map((q) => ({
          ...q,
          items: Array.isArray(q.items) ? (q.items as unknown as QuotePdfItem[]) : [],
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!leadId) return;
    fetchQuotes();
  }, [leadId, refreshKey]);

  useEffect(() => {
    loadAzoupLogo().then(setLogoBase64);
  }, []);

  const handleDownload = (q: QuoteRow) => {
    try {
      const doc = buildQuotePdf({
        clientName: q.client_name,
        companyName: q.company_name,
        phone: q.phone,
        items: q.items,
        notes: q.notes,
        createdAt: q.created_at,
        logoBase64,
      });
      const safeName = q.client_name.replace(/\s+/g, '-').toLowerCase();
      const dateStr = new Date(q.created_at).toISOString().split('T')[0];
      doc.save(`orcamento-${safeName}-${dateStr}.pdf`);
      toast({ title: 'PDF gerado', description: 'Download iniciado.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt size={16} className="text-primary" />
          Orçamentos do Cliente {quotes.length > 0 && <Badge variant="secondary">{quotes.length}</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchQuotes} disabled={loading} className="h-8 gap-1.5">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando orçamentos...</p>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum orçamento gerado para este cliente ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">
                      {new Date(q.created_at).toLocaleDateString('pt-BR')} ·{' '}
                      {new Date(q.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {q.items.length} {q.items.length === 1 ? 'item' : 'itens'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {q.items.map((i) => i.name).join(', ') || '-'}
                  </p>
                  <p className="text-sm font-bold text-primary mt-1">{formatCurrency(q.total)}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => handleDownload(q)}>
                  <Download size={14} /> Baixar PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
