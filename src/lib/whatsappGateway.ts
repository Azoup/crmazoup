import { supabase } from '@/integrations/supabase/client';

const baseUrl = () => {
  const raw = import.meta.env.VITE_WHATSAPP_GATEWAY_URL as string | undefined;
  return raw?.replace(/\/$/, '') ?? '';
};

export function isWhatsAppGatewayConfigured(): boolean {
  return Boolean(baseUrl());
}

/** Bloqueio típico: CRM em HTTPS (produção) chamando gateway em http://127.0.0.1 */
export function getWhatsAppGatewayBlockReason(): string | null {
  const root = baseUrl();
  if (!root) {
    return 'Defina VITE_WHATSAPP_GATEWAY_URL no .env da raiz (ex.: http://127.0.0.1:3847) e reinicie o npm run dev.';
  }
  if (typeof window === 'undefined') return null;
  if (window.location.protocol === 'https:' && root.startsWith('http://')) {
    return (
      'O CRM está em HTTPS e o gateway em HTTP — o navegador bloqueia essa conexão. ' +
      'Em desenvolvimento, abra o CRM em http://localhost:5173 (não use o link HTTPS de produção). ' +
      'O gateway deve estar rodando com: cd whatsapp-gateway && npm start'
    );
  }
  return null;
}

/** Sempre busca token atualizado (evita 401 por JWT expirado no contexto React). */
export async function getWhatsAppAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sessão do CRM expirada. Faça logout e login novamente.');
  }
  return token;
}

export async function whatsappGatewayFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const block = getWhatsAppGatewayBlockReason();
  if (block) throw new Error(block);

  const root = baseUrl();
  if (!root) {
    throw new Error('Gateway não configurado (VITE_WHATSAPP_GATEWAY_URL).');
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string>),
  };

  let r: Response;
  try {
    r = await fetch(`${root}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      'Não foi possível conectar ao gateway em ' +
        root +
        '. Confira se está rodando: cd whatsapp-gateway && npm start',
    );
  }

  const data = (await r.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!r.ok) {
    if (r.status === 401) {
      throw new Error(
        'Sessão inválida ou expirada. Saia do CRM, entre de novo e clique em "Gerar QR Code". ' +
          'Confira também se whatsapp-gateway/.env usa a mesma SUPABASE_ANON_KEY do .env da raiz.',
      );
    }
    if (r.status === 503) {
      throw new Error((data as { error?: string }).error || 'Gateway sem SUPABASE_URL / SUPABASE_ANON_KEY.');
    }
    if (r.status === 404) {
      throw new Error(
        'HTTP 404 — o gateway está desatualizado ou parado. Pare o processo (Ctrl+C), rode de novo: cd whatsapp-gateway && npm start',
      );
    }
    throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
  }
  return data as T;
}

export type WhatsAppGatewayStatus = {
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qrDataUrl: string | null;
  phone: string | null;
  error?: string | null;
};
