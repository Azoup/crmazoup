import { supabase } from '@/integrations/supabase/client';

const baseUrl = () => {
  const raw = import.meta.env.VITE_WHATSAPP_GATEWAY_URL as string | undefined;
  return raw?.replace(/\/$/, '') ?? '';
};

export function isWhatsAppGatewayConfigured(): boolean {
  return Boolean(baseUrl());
}

function isRelativeGatewayUrl(root: string): boolean {
  return root.startsWith('/');
}

/** Bloqueio mixed content: HTTPS + gateway http:// absoluto */
export function getWhatsAppGatewayBlockReason(): string | null {
  const root = baseUrl();
  if (!root) {
    return (
      'Defina VITE_WHATSAPP_GATEWAY_URL no .env (use /wa-gateway em dev) e reinicie o npm run dev.'
    );
  }
  if (typeof window === 'undefined') return null;

  // Caminho relativo = mesma origem (proxy Vite em dev)
  if (isRelativeGatewayUrl(root)) {
    if (import.meta.env.PROD) {
      return (
        'Em produção (HTTPS), /wa-gateway não existe no servidor publicado. ' +
        'Publique o gateway com HTTPS (VPS, Railway, etc.) ou use ngrok: ngrok http 3847 ' +
        'e defina VITE_WHATSAPP_GATEWAY_URL=https://SEU-TUNEL.ngrok-free.app no build.'
      );
    }
    return null;
  }

  if (window.location.protocol === 'https:' && root.startsWith('http://')) {
    return (
      'O CRM está em HTTPS e o gateway em HTTP — o navegador bloqueia essa conexão.\n\n' +
      'Opção A (recomendado): rode o CRM localmente com npm run dev e abra http://localhost:8080 ' +
      '(use VITE_WHATSAPP_GATEWAY_URL=/wa-gateway no .env).\n\n' +
      'Opção B: exponha o gateway com HTTPS (ngrok http 3847) e coloque essa URL HTTPS no .env.'
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

/** Testa se o gateway está no ar (sem autenticação). */
export async function pingWhatsAppGateway(): Promise<{ ok: boolean; detail: string }> {
  const root = baseUrl();
  if (!root) return { ok: false, detail: 'Gateway não configurado (VITE_WHATSAPP_GATEWAY_URL).' };
  try {
    const r = await fetch(`${root}/health`, { method: 'GET' });
    if (r.ok) return { ok: true, detail: 'Gateway online.' };
    if (r.status === 502 || r.status === 503 || r.status === 504) {
      return {
        ok: false,
        detail: `O servidor do WhatsApp (${root}) está fora do ar (HTTP ${r.status}). Reinicie/redeploy o serviço na hospedagem (Railway) — o CRM volta a conectar sozinho.`,
      };
    }
    return { ok: false, detail: `Gateway respondeu HTTP ${r.status}.` };
  } catch {
    return {
      ok: false,
      detail: `Sem resposta de ${root}. O servidor do WhatsApp está desligado ou sem deploy ativo. Suba o serviço (Railway) ou rode localmente: cd whatsapp-gateway && npm start.`,
    };
  }
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
    const ping = await pingWhatsAppGateway();
    throw new Error(ping.detail);
  }

  const data = (await r.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!r.ok) {
    if (r.status === 401) {
      throw new Error(
        'Sessão inválida ou expirada. Saia do CRM, entre de novo e clique em "Gerar QR Code". ' +
          'Confira se o servidor tem VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (iguais ao CRM).',
      );
    }
    if (r.status === 502 || r.status === 503 || r.status === 504) {
      const ping = await pingWhatsAppGateway();
      throw new Error(ping.detail);
    }
    if (r.status === 404) {
      throw new Error(
        'HTTP 404 — o servidor do WhatsApp está desatualizado. Faça o redeploy do gateway (health deve mostrar version: 2).',
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
