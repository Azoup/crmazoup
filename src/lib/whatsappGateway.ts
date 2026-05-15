const baseUrl = () => {
  const raw = import.meta.env.VITE_WHATSAPP_GATEWAY_URL as string | undefined;
  return raw?.replace(/\/$/, '') ?? '';
};

export function isWhatsAppGatewayConfigured(): boolean {
  return Boolean(baseUrl());
}

export async function whatsappGatewayFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const root = baseUrl();
  if (!root) {
    throw new Error('Gateway não configurado (VITE_WHATSAPP_GATEWAY_URL).');
  }
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string>),
  };
  const r = await fetch(`${root}${path}`, { ...init, headers });
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
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
