import type { Lead } from '@/types/lead';

export type AcFieldValueRow = {
  fieldId?: string | null;
  fieldDef?: { perstag?: string; title?: string } | null;
  value?: unknown;
};

export type AcImportRaw = {
  contact?: { contact?: Record<string, unknown> };
  fieldValues?: AcFieldValueRow[];
  contactData?: Record<string, unknown> | { contactDatum?: Record<string, unknown> };
  tags?: string[];
};

const UTM_KEYS = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_conjunto'] as const;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function strValue(value: unknown): string | null {
  if (value == null) return null;
  const s = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value);
  const t = s.trim();
  return t || null;
}

/** Extrai o ID do contato de URL do AC ou de um número puro. */
export function parseActiveCampaignContactId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/\/contacts\/(\d+)/i);
  return m ? m[1] : null;
}

export function matchUtmColumn(perstag: string, title: string): (typeof UTM_KEYS)[number] | null {
  const candidates = [perstag, title].map(norm);
  const has = (sub: string) => candidates.some((c) => c.includes(sub));
  if (has('utmsource') || (has('source') && has('utm'))) return 'utm_source';
  if (has('utmcampaign') || has('campaign') || has('campanha')) return 'utm_campaign';
  if (has('utmmedium') || (has('medium') && has('utm'))) return 'utm_medium';
  if (has('utmconjunto') || has('conjunto') || has('adset')) return 'utm_conjunto';
  return null;
}

type CrmScalarKey =
  | 'confection_type'
  | 'company'
  | 'website'
  | 'whatsapp'
  | 'email'
  | 'pieces_per_month'
  | 'meeting_pain'
  | 'cpf_cnpj';

function matchCustomFieldToLead(perstag: string, title: string): CrmScalarKey | null {
  const hay = `${perstag} ${title}`.toLowerCase();
  const n = norm(hay);
  if (n.includes('utm')) return null;
  if (n.includes('confecc') || n.includes('segment') || n.includes('nicho') || n.includes('tipode')) {
    return 'confection_type';
  }
  if (n.includes('website') || n.includes('siteurl') || (n.includes('site') && !n.includes('visita'))) {
    return 'website';
  }
  if (n.includes('peca') || n.includes('piece') || n.includes('volume') || n.includes('produz')) {
    return 'pieces_per_month';
  }
  if (n.includes('dor') || n.includes('pain') || n.includes('necessidade')) {
    return 'meeting_pain';
  }
  if (n.includes('cnpj') || n.includes('cpf')) {
    return 'cpf_cnpj';
  }
  if (n.includes('empresa') && !n.includes('utm')) {
    return 'company';
  }
  if (n.includes('whatsapp') || n.includes('zap') || n.includes('celular')) {
    return 'whatsapp';
  }
  if (n.includes('email') && !n.includes('utm')) {
    return 'email';
  }
  return null;
}

function contactDatum(raw: AcImportRaw): Record<string, unknown> | null {
  const cd = raw.contactData;
  if (!cd || typeof cd !== 'object') return null;
  if ('contactDatum' in cd && cd.contactDatum && typeof cd.contactDatum === 'object') {
    return cd.contactDatum as Record<string, unknown>;
  }
  return cd as Record<string, unknown>;
}

export interface AcImportPreview {
  payload: Partial<Lead>;
  unmappedFields: { fieldId: string | null; title: string; perstag: string; value: unknown }[];
}

/** Mapeia resposta da API/debug do ActiveCampaign para campos do CRM. */
export function mapAcImportToLead(raw: AcImportRaw): AcImportPreview {
  const c = raw.contact?.contact;
  const unmappedFields: AcImportPreview['unmappedFields'] = [];
  const payload: Partial<Lead> = {};

  if (c) {
    const first = strValue(c.firstName) || '';
    const last = strValue(c.lastName) || '';
    const fullName = `${first} ${last}`.trim();
    if (fullName) payload.name = fullName.substring(0, 255);
    const email = strValue(c.email);
    if (email) payload.email = email.substring(0, 255);
    const phone = strValue(c.phone);
    if (phone) payload.whatsapp = phone.substring(0, 50);
    const org = strValue(c.orgname);
    if (org) payload.company = org.substring(0, 200);
    if (c.id != null) payload.activecampaign_id = String(c.id);
  }

  const utm: Record<(typeof UTM_KEYS)[number], string | null> = {
    utm_source: null,
    utm_campaign: null,
    utm_medium: null,
    utm_conjunto: null,
  };

  for (const fv of raw.fieldValues || []) {
    const def = fv.fieldDef;
    const perstag = def?.perstag || '';
    const title = def?.title || '';
    const value = strValue(fv.value);
    if (!value) continue;

    const utmCol = matchUtmColumn(perstag, title);
    if (utmCol) {
      utm[utmCol] = value.substring(0, 2000);
      continue;
    }

    const leadKey = matchCustomFieldToLead(perstag, title);
    if (leadKey) {
      if (leadKey === 'pieces_per_month') {
        const num = Number(value.replace(/\D/g, ''));
        if (num > 0) payload.pieces_per_month = num;
      } else {
        (payload as Record<string, unknown>)[leadKey] = value;
      }
      continue;
    }

    if (def) {
      unmappedFields.push({
        fieldId: fv.fieldId ?? null,
        title,
        perstag,
        value: fv.value,
      });
    }
  }

  const cd = contactDatum(raw);
  if (cd) {
    if (!utm.utm_source) {
      const v = strValue(cd.ga_campaign_source ?? cd.tracking_source);
      if (v) utm.utm_source = v;
    }
    if (!utm.utm_campaign) {
      const v = strValue(cd.ga_campaign_name ?? cd.tracking_campaign);
      if (v) utm.utm_campaign = v;
    }
    if (!utm.utm_medium) {
      const v = strValue(cd.ga_campaign_medium ?? cd.tracking_medium);
      if (v) utm.utm_medium = v;
    }
    if (!utm.utm_conjunto) {
      const v = strValue(
        cd.ga_campaign_customsegment ?? cd.ga_campaign_content ?? cd.ga_campaign_term,
      );
      if (v) utm.utm_conjunto = v;
    }
  }

  if (utm.utm_source) payload.utm_source = utm.utm_source;
  if (utm.utm_campaign) payload.utm_campaign = utm.utm_campaign;
  if (utm.utm_medium) payload.utm_medium = utm.utm_medium;
  if (utm.utm_conjunto) payload.utm_conjunto = utm.utm_conjunto;

  const tags = raw.tags || [];
  if (tags.length > 0 && !payload.confection_type) {
    payload.confection_type = tags[0].substring(0, 200);
  }

  return { payload, unmappedFields };
}
