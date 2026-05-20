import { describe, expect, it } from 'vitest';
import { Lead } from '@/types/lead';
import {
  computeMonthlySnapshotTotals,
  filterLeadsForMonthlyReport,
} from '@/lib/leadReportTable';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: '1',
    user_id: 'user-a',
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
    next_contact_type: null,
    last_contact: null,
    entry_date: '2026-05-10',
    meeting_pain: null,
    meeting_needs: null,
    meeting_link: null,
    meeting_date: null,
    history: [],
    created_at: '2026-05-10T10:00:00',
    updated_at: '2026-05-10T10:00:00',
    is_new: false,
    manager_notes: null,
    activecampaign_id: null,
    meeting_status: null,
    reference_month: '2026-05',
    pieces_per_month: null,
    responsible_user_id: null,
    lead_source: 'marketing',
    ...overrides,
  };
}

describe('filterLeadsForMonthlyReport', () => {
  it('inclui só marketing com reference_month e user_id', () => {
    const leads = [
      makeLead({ id: '1', reference_month: '2026-05' }),
      makeLead({ id: '2', reference_month: '2026-05', lead_source: 'indicacao' }),
      makeLead({ id: '3', reference_month: '2026-04' }),
      makeLead({ id: '4', reference_month: '2026-05', user_id: 'user-b' }),
    ];
    const filtered = filterLeadsForMonthlyReport(leads, '2026-05', 'user-a');
    expect(filtered.map((l) => l.id)).toEqual(['1']);
  });
});

describe('computeMonthlySnapshotTotals', () => {
  it('conta leads únicos do mês sem somar por dia', () => {
    const leads = [
      makeLead({ id: '1', stage: 'venda' }),
      makeLead({ id: '2', stage: 'perdidos' }),
      makeLead({
        id: '3',
        stage: 'reuniao',
        meeting_date: '2026-05-15T14:00:00',
        meeting_status: 'compareceu',
      }),
    ];
    const totals = computeMonthlySnapshotTotals(leads, '2026-05');
    expect(totals.vendas).toBe(1);
    expect(totals.descartados).toBe(1);
    expect(totals.agendados).toBe(1);
  });
});
