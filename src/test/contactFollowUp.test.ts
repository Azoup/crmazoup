import { describe, it, expect } from 'vitest';
import { getReturnReminderCopy, getNextAttemptNumber } from '@/lib/contactFollowUp';
import { Lead } from '@/types/lead';

const base: Lead = {
  id: '1',
  user_id: 'u',
  name: 'Test',
  company: null,
  confection_type: null,
  whatsapp: '11999999999',
  email: null,
  website: null,
  temperature: 'frio',
  value: 0,
  implementation_value: 0,
  monthly_value: 0,
  stage: 'prospeccao',
  loss_reason: null,
  next_contact: '2026-05-20T10:00:00',
  next_contact_type: 'ligacao',
  last_contact: null,
  entry_date: null,
  meeting_pain: null,
  meeting_needs: null,
  meeting_link: null,
  meeting_date: null,
  history: [{ type: 'whatsapp', note: 'Nova tentativa de contato', date: '2026-05-10', user: 'SDR' }],
  created_at: '2026-05-01',
  updated_at: '2026-05-01',
};

describe('contactFollowUp', () => {
  it('lembrete de ligação na penúltima tentativa', () => {
    expect(getNextAttemptNumber(base)).toBe(2);
    const copy = getReturnReminderCopy(base, 'ligacao');
    expect(copy.title).toContain('Ligar');
    expect(copy.subtitle).toContain('penúltima');
  });

  it('lembrete de mensagem', () => {
    const copy = getReturnReminderCopy(base, 'mensagem');
    expect(copy.title).toContain('Retornar');
    expect(copy.subtitle).toContain('mensagem');
  });
});
