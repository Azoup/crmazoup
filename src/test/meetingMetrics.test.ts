import { describe, it, expect } from 'vitest';
import {
  getMeetingAttributionMonth,
  getFirstReuniaoScheduledMonth,
  isMeetingScheduledInMonth,
  isMeetingNoShowInMonth,
} from '@/lib/meetingMetrics';
import { Lead } from '@/types/lead';

const baseLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: '1',
  user_id: 'u1',
  name: 'Test',
  company: null,
  confection_type: null,
  whatsapp: null,
  email: null,
  website: null,
  temperature: 'frio',
  value: 0,
  implementation_value: 0,
  monthly_value: 0,
  stage: 'prospeccao',
  loss_reason: null,
  next_contact: null,
  last_contact: null,
  entry_date: '2026-05-01',
  meeting_pain: null,
  meeting_needs: null,
  meeting_link: null,
  meeting_date: null,
  history: [],
  created_at: '2026-05-01T10:00:00',
  updated_at: '2026-05-01T10:00:00',
  reference_month: '2026-05',
  ...overrides,
});

describe('meetingMetrics', () => {
  it('usa mês da meeting_date mesmo com reference_month anterior', () => {
    const lead = baseLead({
      reference_month: '2026-05',
      meeting_date: '2026-06-15T14:00:00',
      stage: 'reuniao',
    });
    expect(getMeetingAttributionMonth(lead)).toBe('2026-06');
    expect(isMeetingScheduledInMonth(lead, '2026-06')).toBe(true);
    expect(isMeetingScheduledInMonth(lead, '2026-05')).toBe(false);
  });

  it('conta reunião marcada pelo histórico ao mover para reuniao', () => {
    const lead = baseLead({
      reference_month: '2026-05',
      stage: 'reuniao',
      history: [
        {
          type: 'stage_change',
          note: 'Fase: INTERESSE → REUNIAO',
          date: '2026-06-02T15:00:00',
          user: 'SDR',
        },
      ],
    });
    expect(getFirstReuniaoScheduledMonth(lead.history)).toBe('2026-06');
    expect(isMeetingScheduledInMonth(lead, '2026-06')).toBe(true);
  });

  it('no_show no mesmo mês da reunião agendada', () => {
    const lead = baseLead({
      meeting_date: '2026-05-20T10:00:00',
      meeting_status: 'no_show',
      stage: 'reuniao',
    });
    expect(isMeetingNoShowInMonth(lead, '2026-05')).toBe(true);
    expect(isMeetingNoShowInMonth(lead, '2026-06')).toBe(false);
  });
});
