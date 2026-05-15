import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getWhatsAppAccessToken,
  getWhatsAppGatewayBlockReason,
  isWhatsAppGatewayConfigured,
  whatsappGatewayFetch,
  type WhatsAppGatewayStatus,
} from '@/lib/whatsappGateway';
import { Loader2, LogOut, Send, Smartphone } from 'lucide-react';

interface WhatsAppViewProps {
  leads: Lead[];
}

function digitsPhone(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '');
}

export function WhatsAppView({ leads }: WhatsAppViewProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<WhatsAppGatewayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [message, setMessage] = useState('');

  const configured = isWhatsAppGatewayConfigured();
  const gatewayBlock = getWhatsAppGatewayBlockReason();
  const token = session?.access_token;
  const didAutoReset = useRef(false);

  const leadsWithPhone = useMemo(
    () =>
      leads.filter((l) => {
        const d = digitsPhone(l.whatsapp);
        return d.length >= 10;
      }),
    [leads],
  );

  const selectedLead = useMemo(
    () => leadsWithPhone.find((l) => l.id === selectedLeadId) ?? null,
    [leadsWithPhone, selectedLeadId],
  );

  const refreshStatus = useCallback(async () => {
    if (!configured || gatewayBlock) {
      if (gatewayBlock) {
        setStatus({
          status: 'disconnected',
          qrDataUrl: null,
          phone: null,
          error: gatewayBlock,
        });
      }
      return;
    }
    if (!session) return;
    try {
      const accessToken = await getWhatsAppAccessToken();
      const data = await whatsappGatewayFetch<WhatsAppGatewayStatus>('/api/whatsapp/status', accessToken);
      setStatus(data);
    } catch (e) {
      console.error(e);
      setStatus({
        status: 'disconnected',
        qrDataUrl: null,
        phone: null,
        error: e instanceof Error ? e.message : 'Falha ao contactar o gateway',
      });
    }
  }, [configured, gatewayBlock, session]);

  const applyGatewayStatus = (data: WhatsAppGatewayStatus) => {
    setStatus({
      status: data.status,
      qrDataUrl: data.qrDataUrl,
      phone: data.phone,
      error: data.error,
    });
    if (!data.qrDataUrl && data.status !== 'connected') {
      toast({
        title: 'QR ainda não disponível',
        description: data.error || 'Aguarde alguns segundos ou veja o terminal do gateway.',
      });
    }
  };

  const handleResetQr = async () => {
    if (!session || gatewayBlock) return;
    setLoading(true);
    try {
      const accessToken = await getWhatsAppAccessToken();

      let data: WhatsAppGatewayStatus;
      try {
        // Preferido: funciona no gateway atualizado sem depender de POST /reset
        data = await whatsappGatewayFetch<WhatsAppGatewayStatus>(
          '/api/whatsapp/status?reset=1',
          accessToken,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (!msg.includes('404')) throw e;
        // Gateway muito antigo: logout limpa sessão e status recria o socket
        await whatsappGatewayFetch('/api/whatsapp/logout', accessToken, {
          method: 'POST',
          body: '{}',
        }).catch(() => undefined);
        data = await whatsappGatewayFetch<WhatsAppGatewayStatus>('/api/whatsapp/status', accessToken);
      }

      applyGatewayStatus(data);
    } catch (e) {
      toast({
        title: 'Erro ao gerar QR',
        description:
          e instanceof Error
            ? e.message
            : 'Reinicie o gateway: cd whatsapp-gateway && npm start',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!configured || !session || gatewayBlock) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshStatus();
    };
    void tick();
    const ms = status?.status === 'connected' ? 12000 : 1500;
    const id = window.setInterval(tick, ms);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [configured, session, gatewayBlock, refreshStatus, status?.status]);

  useEffect(() => {
    if (didAutoReset.current || gatewayBlock || !configured || !session) return;
    if (status?.qrDataUrl || status?.status === 'connected' || status?.status === 'qr') return;
    if (status?.error?.includes('401') || status?.error?.includes('Sessão')) return;
    if (status?.status === 'disconnected' && !status?.qrDataUrl) {
      didAutoReset.current = true;
      void handleResetQr();
    }
  }, [status, gatewayBlock, configured, session]);

  const handleLogout = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const accessToken = await getWhatsAppAccessToken();
      await whatsappGatewayFetch('/api/whatsapp/logout', accessToken, { method: 'POST', body: '{}' });
      toast({ title: 'WhatsApp desconectado', description: 'Sessão removida neste servidor.' });
      setStatus({ status: 'disconnected', qrDataUrl: null, phone: null });
    } catch (e) {
      toast({
        title: 'Erro',
        description: e instanceof Error ? e.message : 'Falha ao desconectar',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!session || !selectedLead?.whatsapp) {
      toast({ title: 'Selecione um lead', description: 'Escolha um lead com WhatsApp.', variant: 'destructive' });
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      toast({ title: 'Mensagem vazia', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const accessToken = await getWhatsAppAccessToken();
      await whatsappGatewayFetch('/api/whatsapp/send', accessToken, {
        method: 'POST',
        body: JSON.stringify({ phone: selectedLead.whatsapp, message: trimmed }),
      });
      toast({ title: 'Mensagem enviada', description: `Para ${selectedLead.name}` });
      setMessage('');
    } catch (e) {
      toast({
        title: 'Não foi possível enviar',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (!configured) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="size-5" /> WhatsApp
            </CardTitle>
            <CardDescription>
              Para enviar mensagens pelo CRM sem abrir o WhatsApp Web no navegador, é necessário um pequeno
              servidor do lado do Baileys (protocolo oficial de multi-dispositivo), rodando junto com suas
              credenciais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                No arquivo <code className="text-foreground">.env</code> do front, defina{' '}
                <code className="text-foreground">VITE_WHATSAPP_GATEWAY_URL</code> com a URL do gateway (ex.:{' '}
                <code className="text-foreground">http://127.0.0.1:3847</code> em desenvolvimento).
              </li>
              <li>
                Na pasta <code className="text-foreground">whatsapp-gateway</code>, crie um{' '}
                <code className="text-foreground">.env</code> com{' '}
                <code className="text-foreground">SUPABASE_URL</code>,{' '}
                <code className="text-foreground">SUPABASE_ANON_KEY</code> (iguais ao projeto) e opcionalmente{' '}
                <code className="text-foreground">PORT=3847</code>.
              </li>
              <li>
                Execute: <code className="text-foreground">cd whatsapp-gateway &amp;&amp; npm install &amp;&amp; npm start</code>
              </li>
              <li>Recarregue o CRM e volte nesta tela para escanear o QR Code.</li>
            </ol>
            <p className="text-xs pt-2 border-t border-border">
              Em produção (HTTPS), o gateway também precisa ser HTTPS no mesmo domínio ou com CORS liberado, para o
              navegador permitir as chamadas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-5" /> Conexão
          </CardTitle>
          <CardDescription>
            Escaneie o QR com o WhatsApp no celular (Aparelhos conectados). A sessão fica salva neste servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(gatewayBlock || status?.error) && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              <p className="font-semibold">Não foi possível conectar ao gateway</p>
              <p>{gatewayBlock || status?.error}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Status</p>
              <p className="font-semibold capitalize">
                {!status && 'Carregando…'}
                {status?.status === 'disconnected' && 'Desconectado'}
                {status?.status === 'connecting' && 'Conectando…'}
                {status?.status === 'qr' && 'Aguardando leitura do QR'}
                {status?.status === 'connected' && 'Conectado'}
              </p>
              {status?.status === 'connected' && status.phone && (
                <p className="text-sm text-muted-foreground mt-1">Conta: {status.phone}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={loading || status?.status === 'disconnected'}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              <span className="ml-2">Sair</span>
            </Button>
          </div>

          {status?.qrDataUrl && (
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted border border-border">
              <p className="text-sm text-center text-muted-foreground">Abra o WhatsApp → ⋮ ou Configurações → Aparelhos conectados → Conectar aparelho</p>
              <img src={status.qrDataUrl} alt="QR Code WhatsApp" className="w-56 h-56 md:w-64 md:h-64 rounded-lg bg-white p-2" />
            </div>
          )}

          {!status?.qrDataUrl && status?.status !== 'connected' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {status?.status === 'connecting'
                  ? 'Gerando QR Code com o WhatsApp…'
                  : 'Se o QR não aparecer em alguns segundos, clique em "Gerar QR Code".'}
              </p>
              {status?.error && (
                <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  {status.error}
                </p>
              )}
              <Button variant="secondary" className="w-full" onClick={handleResetQr} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Gerar QR Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enviar para lead</CardTitle>
          <CardDescription>Mensagem de texto (o número vem do cadastro do lead).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Lead</Label>
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um lead com WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                {leadsWithPhone.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} — {l.whatsapp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem…"
              rows={6}
              className="resize-none"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSend}
            disabled={sending || status?.status !== 'connected' || !selectedLeadId}
          >
            {sending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
            Enviar pelo WhatsApp
          </Button>
          {status?.status !== 'connected' && (
            <p className="text-xs text-muted-foreground">Conecte o WhatsApp ao lado para habilitar o envio.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
