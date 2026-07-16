import { Lead } from '@/types/lead';

/**
 * Calcula um score do lead de 0 a 100 usado para ordenação
 * e para exibição de "temperatura de negócio" no card.
 * Puro, não depende de banco. Não altera nenhum dado.
 */
export function calculateLeadScore(lead: Lead): number {
  let score = 0;

  // 1) Temperatura (até 40)
  if (lead.temperature === 'quente') score += 40;
  else if (lead.temperature === 'morno') score += 25;
  else score += 10;

  // 2) Valor da oportunidade (até 25) — escala log para não deixar 1 lead gigante dominar
  const value = Number(lead.value) || 0;
  if (value > 0) {
    // 500 -> ~5, 5k -> ~13, 50k -> ~21, 500k+ -> 25
    const pts = Math.min(25, Math.round(Math.log10(value + 1) * 6));
    score += pts;
  }

  // 3) Recência de interação (até 20)
  const lastRaw = lead.last_contact || lead.updated_at;
  if (lastRaw) {
    const last = new Date(lastRaw).getTime();
    if (!isNaN(last)) {
      const days = Math.max(0, (Date.now() - last) / 86400000);
      if (days <= 1) score += 20;
      else if (days <= 3) score += 15;
      else if (days <= 7) score += 10;
      else if (days <= 14) score += 5;
    }
  }

  // 4) Engajamento (até 15)
  const history = Array.isArray(lead.history) ? lead.history.length : 0;
  score += Math.min(8, history); // até 8
  if (lead.new_system_link_sent) score += 4;
  if (lead.is_live_launch && lead.live_launch_contacted) score += 3;

  // Penalidades leves para estágios frios
  if (lead.stage === 'congelados') score = Math.round(score * 0.6);
  if (lead.stage === 'perdidos') score = Math.round(score * 0.2);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function leadScoreColor(score: number): string {
  if (score >= 75) return 'bg-temp-hot';
  if (score >= 50) return 'bg-temp-warm';
  if (score >= 25) return 'bg-primary/60';
  return 'bg-temp-cold';
}

export function leadScoreLabel(score: number): string {
  if (score >= 75) return 'Muito quente';
  if (score >= 50) return 'Quente';
  if (score >= 25) return 'Morno';
  return 'Frio';
}
