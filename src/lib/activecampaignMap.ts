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

export type UtmColumn = 'utm_source' | 'utm_campaign' | 'utm_medium' | 'utm_conjunto';

const UTM_KEYS: UtmColumn[] = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_conjunto'];

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

/**
 * Mapeia perstag/título do ActiveCampaign → coluna CRM.
 * Aceita rótulos da seção Marketing: utm-source, utm_campaign, utm_medium, utm_conjunto
 */
export function fieldToUtmColumn(perstag: string, title: string): UtmColumn | null {
  const tags = [norm(perstag || ''), norm(title || '')].filter(Boolean);
  if (tags.length === 0) return null;

  const exact: Record<string, UtmColumn> = {
    utmsource: 'utm_source',
    utmcampaign: 'utm_campaign',
    utmmedium: 'utm_medium',
    utmconjunto: 'utm_conjunto',
    utmorigem: 'utm_source',
    utmmeio: 'utm_medium',
    utmcampanha: 'utm_campaign',
  };
  for (const t of tags) {
    if (exact[t]) return exact[t];
  }

  const hay = `${perstag} ${title}`.toLowerCase();
  if (!hay.includes('utm') && !tags.some((t) => ['source', 'campaign', 'medium', 'conjunto', 'campanha', 'meio', 'origem'].includes(t))) {
    return null;
  }

  if (hay.includes('utm_conjunto') || hay.includes('utmconjunto') || hay.includes('conjunto') || hay.includes('adset')) {
    return 'utm_conjunto';
  }
  if (hay.includes('utm_campaign') || hay.includes('utmcampaign') || hay.includes('campanha')) {
    return 'utm_campaign';
  }
  if (hay.includes('utm_medium') || hay.includes('utmmedium') || hay.includes('meio')) {
    return 'utm_medium';
  }
  if (hay.includes('utm_source') || hay.includes('utmsource') || hay.includes('origem')) {
    return 'utm_source';
  }
  if (hay.includes('utm')) {
    if (hay.includes('conjunto') || hay.includes('adset')) return 'utm_conjunto';
    if (hay.includes('campaign') || hay.includes('campanha')) return 'utm_campaign';
    if (hay.includes('medium') || hay.includes('meio')) return 'utm_medium';
    if (hay.includes('source') || hay.includes('origem')) return 'utm_source';
  }
  for (const k of tags) {
    if (k.includes('conjunto')) return 'utm_conjunto';
    if (k.includes('campaign') || k.includes('campanha')) return 'utm_campaign';
    if (k.includes('medium') || k.includes('meio')) return 'utm_medium';
    if (k.includes('source') || k.includes('origem')) return 'utm_source';
  }

  return null;
}

/** @deprecated use fieldToUtmColumn */
export function matchUtmColumn(perstag: string, title: string): UtmColumn | null {
  return fieldToUtmColumn(perstag, title);
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
  const n = norm(`${perstag} ${title}`);
  if (n.includes('utm')) return null;
  if (n.includes('confecc') || n.includes('segment') || n.includes('nicho') || n.includes('tipode')) {
    return 'confection_type';
  }
  if (n.includes('website') || n.includes('siteurl')) return 'website';
  if (n.includes('peca') || n.includes('piece') || n.includes('volume') || n.includes('produz')) {
    return 'pieces_per_month';
  }
  if (n.includes('dor') || n.includes('pain') || n.includes('necessidade')) return 'meeting_pain';
  if (n.includes('cnpj') || n.includes('cpf')) return 'cpf_cnpj';
  if (n.includes('empresa')) return 'company';
  if (n.includes('whatsapp') || n.includes('zap') || n.includes('celular')) return 'whatsapp';
  if (n.includes('email')) return 'email';
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

export function extractUtmsFromFieldValues(fieldValues: AcFieldValueRow[]): Partial<Pick<Lead, UtmColumn>> {
  const utm: Record<UtmColumn, string | null> = {
    utm_source: null,
    utm_campaign: null,
    utm_medium: null,
    utm_conjunto: null,
  };

  for (const fv of fieldValues) {
    const def = fv.fieldDef;
    const perstag = def?.perstag || '';
    const title = def?.title || '';
    const value = strValue(fv.value);
    if (!value) continue;

    const col = fieldToUtmColumn(perstag, title);
    if (col) utm[col] = value.substring(0, 2000);
  }

  const out: Partial<Pick<Lead, UtmColumn>> = {};
  for (const k of UTM_KEYS) {
    if (utm[k]) out[k] = utm[k];
  }
  return out;
}

function applyContactDatumUtms(
  utm: Record<UtmColumn, string | null>,
  raw: AcImportRaw,
): void {
  const cd = contactDatum(raw);
  if (!cd) return;
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

export interface AcImportPreview {
  payload: Partial<Lead>;
  marketing: Partial<Pick<Lead, UtmColumn>>;
  unmappedFields: { fieldId: string | null; title: string; perstag: string; value: unknown }[];
}

/** Mapeia contato AC (nome, telefone, marketing/UTM) para campos do CRM. */
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

  const marketing = extractUtmsFromFieldValues(raw.fieldValues || []);
  const utmFull: Record<UtmColumn, string | null> = {
    utm_source: marketing.utm_source ?? null,
    utm_campaign: marketing.utm_campaign ?? null,
    utm_medium: marketing.utm_medium ?? null,
    utm_conjunto: marketing.utm_conjunto ?? null,
  };
  applyContactDatumUtms(utmFull, raw);

  if (utmFull.utm_source) payload.utm_source = utmFull.utm_source;
  if (utmFull.utm_campaign) payload.utm_campaign = utmFull.utm_campaign;
  if (utmFull.utm_medium) payload.utm_medium = utmFull.utm_medium;
  if (utmFull.utm_conjunto) payload.utm_conjunto = utmFull.utm_conjunto;

  for (const fv of raw.fieldValues || []) {
    const def = fv.fieldDef;
    const perstag = def?.perstag || '';
    const title = def?.title || '';
    const value = strValue(fv.value);
    if (!value || !def) continue;
    if (fieldToUtmColumn(perstag, title)) continue;

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

    unmappedFields.push({
      fieldId: fv.fieldId ?? null,
      title,
      perstag,
      value: fv.value,
    });
  }

  const tags = raw.tags || [];
  if (tags.length > 0 && !payload.confection_type) {
    payload.confection_type = tags[0].substring(0, 200);
  }

  return {
    payload,
    marketing: {
      utm_source: payload.utm_source ?? null,
      utm_campaign: payload.utm_campaign ?? null,
      utm_medium: payload.utm_medium ?? null,
      utm_conjunto: payload.utm_conjunto ?? null,
    },
    unmappedFields,
  };
}
