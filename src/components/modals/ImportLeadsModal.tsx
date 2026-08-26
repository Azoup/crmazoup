import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface Props {
  onClose: () => void;
  onImported?: () => void;
  /** Etapa de destino dos leads importados. */
  stage?: string;
  /** Temperatura aplicada aos leads importados. */
  temperature?: 'frio' | 'morno' | 'quente';
  /** Origem do lead (define em qual aba ele aparece). */
  leadSource?: string;
  /** Nome da etapa exibido na descrição. */
  stageLabel?: string;
}


type Row = Record<string, unknown>;

function val(row: Row, keys: string[]): string | null {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const map: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) map[norm(k)] = v;
  for (const k of keys) {
    const v = map[norm(k)];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

const digits = (v: string | null) => (v ? v.replace(/\D/g, '') || null : null);

export function ImportLeadsModal({ onClose, onImported }: Props) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const handleFile = async (file: File) => {
    if (!user) return;
    setLoading(true);
    setResult(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows: Row[] = [];
      for (const sheetName of wb.SheetNames) {
        const json = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], { defval: null });
        rows.push(...json);
      }

      const parsed = rows
        .map((r) => ({
          name: val(r, ['Nome', 'Nome Completo', 'name']),
          whatsapp: digits(val(r, ['Whatsapp', 'WhatsApp', 'telefone', 'celular', 'phone'])),
          email: val(r, ['Email', 'E-mail', 'E-mail Profissional']),
          company: val(r, ['Nome da Confecção', 'Empresa', 'company']),
          confection_type: val(r, ['Segmento', 'Melhor descrição sobre a empresa', 'Tipo de Produção']),
          meeting_pain: val(r, ['Maior desafio', 'Dificuldade', 'Principal Dificuldade']),
          utm_source: val(r, ['utm_source', 'utm_id']),
          utm_campaign: val(r, ['utm_campaign', 'utm_term']),
          utm_conjunto: val(r, ['utm_content', 'utm_conjunto']),
        }))
        .filter((r) => r.name || r.whatsapp || r.email);

      if (parsed.length === 0) {
        toast({ title: 'Nenhum lead encontrado na planilha', variant: 'destructive' });
        return;
      }

      // Busca leads existentes para não duplicar
      const { data: existing } = await supabase.from('leads').select('whatsapp, email').limit(10000);
      const phones = new Set((existing || []).map((l) => (l.whatsapp || '').replace(/\D/g, '')).filter(Boolean));
      const emails = new Set((existing || []).map((l) => (l.email || '').toLowerCase()).filter(Boolean));

      const toInsert: { user_id: string; name: string; [k: string]: unknown }[] = [];
      let skipped = 0;
      for (const r of parsed) {
        const p = r.whatsapp || '';
        const e = (r.email || '').toLowerCase();
        if ((p && phones.has(p)) || (e && emails.has(e))) {
          skipped++;
          continue;
        }
        if (p) phones.add(p);
        if (e) emails.add(e);
        toInsert.push({
          user_id: user.id,
          name: (r.name || r.company || r.email || r.whatsapp)!.substring(0, 255),
          company: r.company,
          confection_type: r.confection_type,
          whatsapp: r.whatsapp,
          email: r.email,
          meeting_pain: r.meeting_pain,
          utm_source: r.utm_source,
          utm_campaign: r.utm_campaign,
          utm_conjunto: r.utm_conjunto,
          stage: 'interesse',
          temperature: 'morno',
          lead_source: 'marketing',
          is_new: true,
          history: [
            {
              type: 'sistema',
              note: '📥 Importado da planilha de leads',
              date: new Date().toISOString(),
              user: profile?.name || 'Importação',
            },
          ],
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('leads').insert(toInsert as never);
        if (error) throw error;
      }

      setResult({ created: toInsert.length, skipped });
      toast({
        title: 'Importação concluída',
        description: `${toInsert.length} novo(s) lead(s) em Interesse • ${skipped} já existiam`,
      });
      onImported?.();
    } catch (err) {
      toast({
        title: 'Erro ao importar',
        description: err instanceof Error ? err.message : 'Falha ao ler a planilha',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-primary" /> Importar leads da planilha
          </DialogTitle>
          <DialogDescription>
            Envie o arquivo .xlsx sempre que for atualizado. Só os leads novos entram — os já cadastrados
            (mesmo WhatsApp ou e-mail) são ignorados. Todos vão para a coluna <b>Interesse</b> no topo.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/60 transition-colors">
          {loading ? (
            <Loader2 className="animate-spin text-primary" size={24} />
          ) : (
            <Upload className="text-primary" size={24} />
          )}
          <span className="text-sm text-muted-foreground">
            {loading ? 'Importando...' : 'Clique para selecionar o arquivo (.xlsx / .csv)'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </label>

        {result && (
          <div className="text-sm rounded-lg bg-muted/50 p-3">
            <p className="font-semibold text-success">{result.created} lead(s) importado(s)</p>
            <p className="text-muted-foreground">{result.skipped} já existiam e foram ignorados</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
