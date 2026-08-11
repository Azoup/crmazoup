import { useEffect, useMemo, useState } from 'react';
import { Lead, LeadHistory } from '@/types/lead';
import { useAuth } from '@/contexts/AuthContext';
import { cleanPhoneNumber } from '@/lib/utils';
import { MessageTemplate, applyTemplateVars, loadTemplates } from '@/lib/messageTemplates';
import {
  getWhatsAppAccessToken,
  isWhatsAppGatewayConfigured,
  whatsappGatewayFetch,
  WhatsAppGatewayStatus,
} from '@/lib/whatsappGateway';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle, Send, Loader2, MessageCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const BULK_LIMIT = 50;

interface Props {
  leads: Lead[];
  onClose: () => void;
  addHistory?: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
}

type SendResult = { lead: Lead; ok: boolean; error?: string };

export function BulkWhatsAppModal({ leads, onClose, addHistory }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SendResult[]>([]);
  const [gatewayReady, setGatewayReady] = useState<boolean | null>(null);

  const targets = useMemo(
    () => leads.filter((l) => !!l.whatsapp).slice(0, BULK_LIMIT),
    [leads],
  );
  const withoutPhone = leads.length - leads.filter((l) => !!l.whatsapp).length;

  useEffect(() => {
    setTemplates(loadTemplates(user?.id));
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isWhatsAppGatewayConfigured()) {
        if (active) setGatewayReady(false);
        return;
      }
      try {
        const token = await getWhatsAppAccessToken();
        const data = await whatsappGatewayFetch<WhatsAppGatewayStatus>(
          '/api/whatsapp/status',
          token,
        );
        if (active) setGatewayReady(data.status === 'connected');
      } catch {
        if (active) setGatewayReady(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const finalMessage = (lead: Lead) => {
    let msg = applyTemplateVars(body, lead);
    if (profile?.signature) msg += `\n\n${profile.signature}`;
    return msg;
  };

  const handleSendAutomatic = async () => {
    if (!body.trim()) {
      toast({ title: 'Escreva uma mensagem', variant: 'destructive' });
      return;
    }
    setSending(true);
    setResults([]);
    setProgress(0);
    const out: SendResult[] = [];
    try {
      const token = await getWhatsAppAccessToken();
      for (let i = 0; i < targets.length; i++) {
        const lead = targets[i];
        const msg = finalMessage(lead);
        try {
          await whatsappGatewayFetch('/api/whatsapp/send', token, {
            method: 'POST',
            body: JSON.stringify({ phone: lead.whatsapp, message: msg }),
          });
          out.push({ lead, ok: true });
          await addHistory?.(lead.id, 'whatsapp', `Envio em massa: "${msg}"`);
        } catch (e) {
          out.push({ lead, ok: false, error: e instanceof Error ? e.message : 'Erro' });
        }
        setResults([...out]);
        setProgress(Math.round(((i + 1) / targets.length) * 100));
        // pequeno intervalo para evitar bloqueio do WhatsApp
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1500));
        }
      }
      const okCount = out.filter((r) => r.ok).length;
      toast({
        title: 'Disparo concluído',
        description: `${okCount} de ${targets.length} mensagens enviadas.`,
      });
    } catch (e) {
      toast({
        title: 'Falha no disparo',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendViaWeb = async () => {
    if (!body.trim()) {
      toast({ title: 'Escreva uma mensagem', variant: 'destructive' });
      return;
    }
    setSending(true);
    const out: SendResult[] = [];
    for (let i = 0; i < targets.length; i++) {
      const lead = targets[i];
      const msg = finalMessage(lead);
      const phone = cleanPhoneNumber(lead.whatsapp || '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      out.push({ lead, ok: true });
      await addHistory?.(lead.id, 'whatsapp', `Envio em massa (WhatsApp Web): "${msg}"`);
      setResults([...out]);
      setProgress(Math.round(((i + 1) / targets.length) * 100));
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 600));
    }
    setSending(false);
    toast({ title: 'Abas abertas', description: `${targets.length} conversas abertas no WhatsApp Web.` });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card glass border border-border/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-success" size={18} />
            <h2 className="font-bold text-foreground">Mensagem em massa</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={sending}>
            <XCircle size={18} />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">{targets.length}</strong> lead(s) com WhatsApp serão
            contatados (limite de {BULK_LIMIT} por vez).
            {withoutPhone > 0 && (
              <span className="block text-warning mt-1">
                {withoutPhone} lead(s) sem WhatsApp foram ignorados.
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Usar template</label>
            <Select
              onValueChange={(id) => {
                const t = templates.find((x) => x.id === id);
                if (t) setBody(t.body);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolher template salvo" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Mensagem padrão — variáveis: {'{nome}'} {'{primeiro_nome}'} {'{empresa}'} {'{tipo}'}
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Olá {primeiro_nome}, tudo bem? Aqui é da Azoup..."
            />
          </div>

          {gatewayReady === false && (
            <div className="flex gap-2 text-xs bg-warning/10 text-warning border border-warning/30 rounded-lg p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                WhatsApp não conectado no servidor. Você ainda pode disparar abrindo as conversas no
                WhatsApp Web (uma aba por lead).
              </span>
            </div>
          )}

          {(sending || results.length > 0) && (
            <div className="space-y-2">
              <Progress value={progress} />
              <div className="max-h-40 overflow-y-auto text-xs space-y-1 scrollbar-thin">
                {results.map((r) => (
                  <div key={r.lead.id} className="flex justify-between gap-2">
                    <span className="truncate">{r.lead.name}</span>
                    <span className={r.ok ? 'text-success' : 'text-destructive'}>
                      {r.ok ? 'enviado' : r.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border/50 flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Fechar
          </Button>
          <Button variant="outline" onClick={handleSendViaWeb} disabled={sending || targets.length === 0}>
            Abrir no WhatsApp Web
          </Button>
          <Button
            onClick={handleSendAutomatic}
            disabled={sending || targets.length === 0 || gatewayReady === false}
            className="gap-2"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar automaticamente
          </Button>
        </div>
      </div>
    </div>
  );
}
