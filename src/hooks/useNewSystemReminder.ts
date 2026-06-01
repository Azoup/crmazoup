import { useEffect, useRef } from 'react';
import { Lead } from '@/types/lead';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'azoup-new-system-reminders';
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

type ShownMap = Record<string, number>;

function loadShown(): ShownMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as ShownMap;
  } catch {
    return {};
  }
}

function saveShown(map: ShownMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * A cada 5 dias desde o envio (ou desde o último lembrete), dispara um toast
 * pedindo retorno sobre o sistema novo. Para de alertar quando o lead vai
 * para "venda" ou "perdidos".
 */
export function useNewSystemReminder(leads: Lead[]) {
  const lastRunRef = useRef(0);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      if (now - lastRunRef.current < 30_000) return;
      lastRunRef.current = now;

      const shown = loadShown();
      let changed = false;

      for (const lead of leads) {
        if (!lead.new_system_link_sent) continue;
        if (['venda', 'perdidos'].includes(lead.stage)) continue;
        if (!lead.new_system_link_sent_at) continue;

        const sentAt = new Date(lead.new_system_link_sent_at).getTime();
        if (!Number.isFinite(sentAt)) continue;

        const last = shown[lead.id] || sentAt;
        if (now - last >= FIVE_DAYS_MS) {
          toast({
            title: '🔗 Retomar contato — sistema novo',
            description: `Já se passaram 5 dias desde o envio do link para ${lead.name}${lead.company ? ` (${lead.company})` : ''}. Pergunte como está sendo a experiência.`,
            duration: 10_000,
          });
          shown[lead.id] = now;
          changed = true;
        }
      }

      // Limpa registros de leads que não estão mais marcados
      const activeIds = new Set(
        leads.filter(l => l.new_system_link_sent).map(l => l.id),
      );
      for (const id of Object.keys(shown)) {
        if (!activeIds.has(id)) {
          delete shown[id];
          changed = true;
        }
      }

      if (changed) saveShown(shown);
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [leads]);
}
