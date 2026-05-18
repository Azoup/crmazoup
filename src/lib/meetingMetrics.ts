import { Lead, LeadHistory } from '@/types/lead';

/** Mês calendário YYYY-MM a partir de Date local */
export function toReferenceMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Datas de reunião são "horário de parede" no CRM — remove offset/Z antes de parse local.
 */
export function parseMeetingDateLocal(dateStr: string): Date {
  const cleanStr = dateStr
    .replace(/[+-]\d{2}(:\d{2})?$/, '')
    .replace('Z', '')
    .trim();

  if (cleanStr.includes('T')) {
    const [datePart, timePart] = cleanStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const timeParts = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, timeParts[0] || 0, timeParts[1] || 0);
  }

  const [year, month, day] = cleanStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getMonthFromIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = parseMeetingDateLocal(iso);
  if (Number.isNaN(d.getTime())) return null;
  return toReferenceMonth(d);
}

function isReuniaoStageChange(note: string): boolean {
  const upper = note.toUpperCase();
  return upper.includes('→ REUNIAO') || upper.includes('→ REUNIÃO');
}

/** Primeiro mês em que o lead foi movido para a coluna Reunião (histórico). */
export function getFirstReuniaoScheduledMonth(history: LeadHistory[] | undefined): string | null {
  if (!history?.length) return null;

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (const entry of sorted) {
    if (entry.type === 'stage_change' && isReuniaoStageChange(entry.note || '')) {
      const month = getMonthFromIsoDate(entry.date);
      if (month) return month;
    }
  }

  return null;
}

/**
 * Mês em que a reunião conta no dashboard:
 * - Com data agendada: mês da reunião (ex.: lead de maio com reunião em junho → junho).
 * - Sem data: mês em que entrou na coluna Reunião.
 * - Legado: coluna Reunião/Proposta sem histórico → mês da última atualização.
 */
export function getMeetingAttributionMonth(lead: Lead): string | null {
  const fromMeetingDate = lead.meeting_date ? getMonthFromIsoDate(lead.meeting_date) : null;
  const fromHistory = getFirstReuniaoScheduledMonth(lead.history);

  if (fromMeetingDate) return fromMeetingDate;
  if (fromHistory) return fromHistory;

  if (lead.stage === 'reuniao' || lead.stage === 'proposta') {
    return getMonthFromIsoDate(lead.updated_at) ?? getMonthFromIsoDate(lead.last_contact);
  }

  return null;
}

export function leadHasScheduledMeeting(lead: Lead): boolean {
  if (lead.meeting_date) return true;
  if (getFirstReuniaoScheduledMonth(lead.history)) return true;
  return lead.stage === 'reuniao' || lead.stage === 'proposta';
}

export function isMeetingScheduledInMonth(lead: Lead, month: string): boolean {
  if (!leadHasScheduledMeeting(lead)) return false;
  return getMeetingAttributionMonth(lead) === month;
}

export function isMeetingAttendedInMonth(lead: Lead, month: string): boolean {
  return lead.meeting_status === 'compareceu' && getMeetingAttributionMonth(lead) === month;
}

export function isMeetingNoShowInMonth(lead: Lead, month: string): boolean {
  return lead.meeting_status === 'no_show' && getMeetingAttributionMonth(lead) === month;
}
