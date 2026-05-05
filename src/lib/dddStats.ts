import { Lead } from '@/types/lead';

export interface LostByDddStat {
  ddd: string;
  count: number;
  percent: number;
  leads: Lead[];
}

export function extractBrazilianDdd(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');

  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits.slice(2, 4);
  }

  if (digits.length >= 10) {
    return digits.slice(0, 2);
  }

  return 'Sem DDD';
}

export function getLostLeadsByDdd(leads: Lead[]): LostByDddStat[] {
  const lost = leads.filter((lead) => lead.stage === 'perdidos');
  const grouped = lost.reduce<Record<string, Lead[]>>((acc, lead) => {
    const ddd = extractBrazilianDdd(lead.whatsapp || lead.signer_phone);
    acc[ddd] = acc[ddd] || [];
    acc[ddd].push(lead);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([ddd, group]) => ({
      ddd,
      count: group.length,
      percent: lost.length > 0 ? (group.length / lost.length) * 100 : 0,
      leads: group.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    }))
    .sort((a, b) => b.count - a.count || a.ddd.localeCompare(b.ddd, 'pt-BR'));
}