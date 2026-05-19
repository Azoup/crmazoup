import { Lead, LeadHistory, NextContactType } from '@/types/lead';

export const MAX_CONTACT_ATTEMPTS = 3;

const ATTEMPT_ORDINALS = ['primeira', 'segunda', 'terceira', 'quarta', 'quinta'];

export function countContactAttempts(history: LeadHistory[] | undefined): number {
  if (!history?.length) return 0;
  return history.filter((h) => {
    if (['ligacao', 'whatsapp', 'email', 'retorno'].includes(h.type)) return true;
    const note = (h.note || '').toLowerCase();
    return (
      note.includes('tentativa de contato') ||
      note.includes('primeiro contato') ||
      note.includes('segunda tentativa') ||
      note.includes('terceira tentativa') ||
      note.includes('nova tentativa')
    );
  }).length;
}

export function getNextAttemptNumber(lead: Lead): number {
  return countContactAttempts(lead.history) + 1;
}

export function getAttemptOrdinal(attemptNumber: number): string {
  if (attemptNumber >= 1 && attemptNumber <= ATTEMPT_ORDINALS.length) {
    return ATTEMPT_ORDINALS[attemptNumber - 1];
  }
  return `${attemptNumber}ª`;
}

export function resolveNextContactType(
  lead: Lead,
  explicit?: NextContactType | null,
): NextContactType {
  if (explicit === 'ligacao' || explicit === 'mensagem') return explicit;
  if (lead.next_contact_type === 'ligacao' || lead.next_contact_type === 'mensagem') {
    return lead.next_contact_type;
  }
  return 'mensagem';
}

export function getReturnReminderCopy(lead: Lead, contactType?: NextContactType | null) {
  const type = resolveNextContactType(lead, contactType);
  const nextAttempt = getNextAttemptNumber(lead);

  if (type === 'ligacao') {
    const isPenultimate = nextAttempt === MAX_CONTACT_ATTEMPTS - 1;
    return {
      title: '📞 Hora de Ligar!',
      subtitle: isPenultimate
        ? 'Ligue para fazer a penúltima tentativa de contato'
        : `Ligue para a ${getAttemptOrdinal(nextAttempt)} tentativa de contato`,
    };
  }

  return {
    title: '💬 Hora de Retornar!',
    subtitle: `Envie mensagem (WhatsApp ou e-mail) — ${getAttemptOrdinal(nextAttempt)} tentativa de contato`,
  };
}

export function formatScheduledReturnNote(
  nextContact: string,
  contactType: NextContactType,
  lead: Lead,
): string {
  const when = new Date(nextContact).toLocaleString('pt-BR');
  const attempt = getNextAttemptNumber(lead);
  const kind = contactType === 'ligacao' ? 'ligação' : 'mensagem';
  const attemptLabel =
    contactType === 'ligacao' && attempt === MAX_CONTACT_ATTEMPTS - 1
      ? 'penúltima tentativa'
      : `${getAttemptOrdinal(attempt)} tentativa`;
  return `📅 Retorno agendado (${kind}) para ${when} · ${attemptLabel}`;
}

/** Sugere data/hora comercial (1–3 dias úteis, 08:30–17:50) */
export function suggestNextContactDateTime(): string {
  const now = new Date();
  const daysAhead = Math.floor(Math.random() * 3) + 1;
  const target = new Date(now);
  target.setDate(target.getDate() + daysAhead);
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }
  const hour = Math.floor(Math.random() * 9) + 8;
  const minute =
    hour === 8
      ? Math.floor(Math.random() * 3) * 10 + 30
      : hour === 17
        ? Math.floor(Math.random() * 3) * 10
        : Math.floor(Math.random() * 6) * 10;
  const finalHour = Math.min(hour, 17);
  const finalMinute = finalHour === 17 ? Math.min(minute, 50) : minute;

  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}T${String(finalHour).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`;
}
