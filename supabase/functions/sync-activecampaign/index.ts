import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UTM_MAX = 2000;

/** Cache por execução da função: IDs de campo AC → coluna UTM ou null (já tentado). */
const fieldUtmResolveCache = new Map<string, UtmColumn | null>();

function sanitizeString(input: unknown, maxLength: number): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return String(input).substring(0, maxLength);
  return input.trim().substring(0, maxLength).replace(/[<>{}[\]\\]/g, '');
}

/** UTM strings may contain brackets and punctuation — do not strip like sanitizeString */
function sanitizeUtmValue(input: unknown, maxLength: number): string | null {
  if (input === null || input === undefined) return null;
  const s = Array.isArray(input)
    ? input.map((v) => (v == null ? '' : String(v))).filter(Boolean).join(', ')
    : (typeof input === 'string' ? input : String(input));
  const t = s.trim().substring(0, maxLength).replace(/\x00/g, '');
  return t || null;
}

function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function sanitizePhone(phone: unknown): string | null {
  if (phone === null || phone === undefined) return null;
  if (typeof phone !== 'string') return null;
  const sanitized = phone.replace(/[^0-9+() -]/g, '').substring(0, 50);
  return sanitized || null;
}

type UtmColumn = 'utm_source' | 'utm_campaign' | 'utm_medium' | 'utm_conjunto';

interface UtmFields {
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_conjunto: string | null;
}

function emptyUtm(): UtmFields {
  return { utm_source: null, utm_campaign: null, utm_medium: null, utm_conjunto: null };
}

/** Map ActiveCampaign Marketing fields (utm-source, utm_campaign, etc.) → coluna CRM */
function fieldToUtmColumn(perstag: string, title: string): UtmColumn | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const keys = [norm(perstag || ''), norm(title || '')].filter(Boolean);
  if (keys.length === 0) return null;

  const exact: Record<string, UtmColumn> = {
    utmsource: 'utm_source',
    utmcampaign: 'utm_campaign',
    utmmedium: 'utm_medium',
    utmconjunto: 'utm_conjunto',
    utmorigem: 'utm_source',
    utmmeio: 'utm_medium',
    utmcampanha: 'utm_campaign',
  };
  for (const k of keys) {
    if (exact[k]) return exact[k];
  }

  const hay = `${perstag} ${title}`.toLowerCase();
  if (!hay.includes('utm') && !keys.some((t) =>
    ['source', 'campaign', 'medium', 'conjunto', 'campanha', 'meio', 'origem'].includes(t)
  )) {
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
  // utm-source, utm medium (com hífen/espaço no título do AC)
  if (hay.includes('utm')) {
    if (hay.includes('conjunto') || hay.includes('adset')) return 'utm_conjunto';
    if (hay.includes('campaign') || hay.includes('campanha')) return 'utm_campaign';
    if (hay.includes('medium') || hay.includes('meio')) return 'utm_medium';
    if (hay.includes('source') || hay.includes('origem')) return 'utm_source';
  }
  for (const k of keys) {
    if (k.includes('conjunto')) return 'utm_conjunto';
    if (k.includes('campaign') || k.includes('campanha')) return 'utm_campaign';
    if (k.includes('medium') || k.includes('meio')) return 'utm_medium';
    if (k.includes('source') || k.includes('origem')) return 'utm_source';
  }
  return null;
}

function acFieldLabels(f: Record<string, unknown>): { perstag: string; title: string } {
  return {
    perstag: String(f.perstag ?? f.tag ?? ''),
    title: String(f.title ?? f.label ?? f.name ?? ''),
  };
}

function extractFieldIdFromFv(fv: Record<string, unknown>): string | null {
  const raw = fv.field;
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    return String((raw as { id: unknown }).id);
  }
  return String(raw);
}

/**
 * URL da API (não a URL do app .activehosted.com).
 * Ex.: https://azouptecnologia.api-us1.com
 */
function normalizeAcApiUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, '');
  url = url.replace(/\/api\/3\/?$/i, '');
  const hosted = url.match(/^https?:\/\/([^.]+)\.activehosted\.com/i);
  if (hosted) {
    const region = Deno.env.get('ACTIVECAMPAIGN_API_REGION')?.trim() || 'us1';
    url = `https://${hosted[1]}.api-${region}.com`;
    console.log(`ACTIVECAMPAIGN_URL convertida de activehosted → ${url}`);
  }
  return url;
}

/** IDs fixos via secret JSON: {"123":"utm_source","124":"utm_campaign",...} */
function loadEnvFieldIdToUtm(): Record<string, UtmColumn> {
  const raw =
    Deno.env.get('ACTIVECAMPAIGN_UTM_FIELD_IDS') ||
    Deno.env.get('ACTIVE_CAMPAIGN_UTM_FIELD_IDS');
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, UtmColumn> = {};
    const valid: UtmColumn[] = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_conjunto'];
    for (const [id, col] of Object.entries(parsed)) {
      if (valid.includes(col as UtmColumn)) out[String(id)] = col as UtmColumn;
    }
    return out;
  } catch {
    console.warn('ACTIVECAMPAIGN_UTM_FIELD_IDS inválido (esperado JSON)');
    return {};
  }
}

function buildMappedFieldsByColumn(
  fieldIdToUtm: Record<string, UtmColumn>,
  allAcFields: any[],
): Record<string, { id: string; perstag: string; title: string }> {
  const byId = new Map(allAcFields.map((f: any) => [String(f.id), f]));
  const out: Record<string, { id: string; perstag: string; title: string }> = {};
  for (const [fieldId, col] of Object.entries(fieldIdToUtm)) {
    const f = byId.get(fieldId);
    const labels = f ? acFieldLabels(f) : { perstag: '', title: '' };
    out[col] = { id: fieldId, perstag: labels.perstag, title: labels.title };
  }
  return out;
}

/** Quando /fields não lista Marketing, descobre IDs pelos fieldValues dos contatos. */
async function discoverUtmFieldsFromContactSamples(
  contactIds: string[],
  acUrl: string,
  acApiKey: string,
  fieldIdToUtm: Record<string, UtmColumn>,
  maxContacts = 40,
): Promise<number> {
  let added = 0;
  const sample = [...new Set(contactIds.map(String).filter(Boolean))].slice(0, maxContacts);
  for (const contactId of sample) {
    try {
      const r = await fetch(
        `${acUrl}/api/3/contacts/${encodeURIComponent(contactId)}/fieldValues`,
        { headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' } },
      );
      if (!r.ok) continue;
      const data = await r.json();
      for (const fv of data.fieldValues || []) {
        const fieldId = extractFieldIdFromFv(fv);
        if (!fieldId || fieldIdToUtm[fieldId]) continue;
        const col = await resolveUtmColumnForFieldId(fieldId, acUrl, acApiKey, fieldIdToUtm);
        if (col) added++;
      }
    } catch {
      /* ignore */
    }
  }
  if (added > 0) {
    console.log(`UTM bootstrap: ${added} campo(s) mapeado(s) a partir de fieldValues de contatos`);
  }
  return added;
}

interface ListFieldsResult {
  fields: any[];
  lastStatus: number;
  lastError: string | null;
}

async function listAllFields(acUrl: string, acApiKey: string): Promise<ListFieldsResult> {
  const all: any[] = [];
  let offset = 0;
  const limit = 100;
  let lastStatus = 0;
  let lastError: string | null = null;
  const headers = { 'Api-Token': acApiKey, 'Content-Type': 'application/json' };

  while (true) {
    const response = await fetch(
      `${acUrl}/api/3/fields?limit=${limit}&offset=${offset}`,
      { headers },
    );
    lastStatus = response.status;
    if (!response.ok) {
      lastError = await response.text();
      console.error('AC fields API error', lastStatus, lastError);
      break;
    }
    const data = await response.json();
    const fields = Array.isArray(data.fields) ? data.fields : [];
    all.push(...fields);
    if (fields.length < limit) break;
    offset += limit;
  }

  return { fields: all, lastStatus, lastError };
}

async function probeAcApi(
  acUrl: string,
  acApiKey: string,
): Promise<Record<string, unknown>> {
  const headers = { 'Api-Token': acApiKey, 'Content-Type': 'application/json' };
  const fieldsR = await fetch(`${acUrl}/api/3/fields?limit=5`, { headers });
  const contactsR = await fetch(`${acUrl}/api/3/contacts?limit=1`, { headers });
  let fieldsBody: { count?: number; error?: string } = {};
  let contactsBody: { count?: number; error?: string } = {};
  try {
    const fj = await fieldsR.json();
    fieldsBody.count = Array.isArray(fj.fields) ? fj.fields.length : 0;
  } catch {
    fieldsBody.error = 'resposta inválida';
  }
  try {
    const cj = await contactsR.json();
    contactsBody.count = Array.isArray(cj.contacts) ? cj.contacts.length : 0;
  } catch {
    contactsBody.error = 'resposta inválida';
  }
  return {
    ac_url_used: acUrl,
    fields_http: fieldsR.status,
    fields_sample_count: fieldsBody.count,
    fields_error: fieldsR.ok ? null : (fieldsBody.error || 'HTTP ' + fieldsR.status),
    contacts_http: contactsR.status,
    contacts_sample_count: contactsBody.count,
  };
}

async function fetchFieldIdToUtmColumn(
  acUrl: string,
  acApiKey: string,
): Promise<{ map: Record<string, UtmColumn>; raw: any[]; fieldsMeta: ListFieldsResult }> {
  const { fields: all, ...fieldsMeta } = await listAllFields(acUrl, acApiKey);
  const out: Record<string, UtmColumn> = { ...loadEnvFieldIdToUtm() };
  for (const f of all) {
    const { perstag, title } = acFieldLabels(f);
    const col = fieldToUtmColumn(perstag, title);
    if (col && f.id != null) out[String(f.id)] = col;
  }
  console.log(
    `Mapped ${Object.keys(out).length} ActiveCampaign custom fields to UTM columns (de ${all.length} fields totais, ${Object.keys(loadEnvFieldIdToUtm()).length} via env)`,
  );
  return { map: out, raw: all, fieldsMeta };
}

/** Quando o ID não veio no list /fields, busca definição individual (AC às vezes pagina ou filtra diferente). */
async function resolveUtmColumnForFieldId(
  fieldId: string,
  acUrl: string,
  acApiKey: string,
  fieldIdToUtm: Record<string, UtmColumn>,
): Promise<UtmColumn | null> {
  if (fieldIdToUtm[fieldId]) return fieldIdToUtm[fieldId];
  if (fieldUtmResolveCache.has(fieldId)) {
    const cached = fieldUtmResolveCache.get(fieldId)!;
    if (cached) fieldIdToUtm[fieldId] = cached;
    return cached;
  }
  try {
    const r = await fetch(`${acUrl}/api/3/fields/${encodeURIComponent(fieldId)}`, {
      headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
    });
    if (!r.ok) {
      fieldUtmResolveCache.set(fieldId, null);
      return null;
    }
    const data = await r.json();
    const f = data.field;
    if (!f || f.id == null) {
      fieldUtmResolveCache.set(fieldId, null);
      return null;
    }
    const { perstag, title } = acFieldLabels(f);
    const col = fieldToUtmColumn(perstag, title);
    fieldUtmResolveCache.set(fieldId, col);
    if (col) fieldIdToUtm[String(f.id)] = col;
    return col;
  } catch {
    fieldUtmResolveCache.set(fieldId, null);
    return null;
  }
}

interface ValidatedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  orgname: string | null;
  tags: string[];
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_conjunto: string | null;
}

function validateContact(
  contact: unknown,
  contactTags: Record<string, string[]>,
  orgNames: Record<string, string>,
  utmByContactId: Record<string, UtmFields>,
): ValidatedContact | null {
  if (!contact || typeof contact !== 'object') return null;
  const rawContact = contact as Record<string, unknown>;
  if (!rawContact.id) return null;

  const id = String(rawContact.id);
  let orgname = sanitizeString(rawContact.orgname, 200) || null;
  if (!orgname && rawContact.orgid) {
    orgname = orgNames[String(rawContact.orgid)] || null;
  }

  const utm = utmByContactId[id] ?? emptyUtm();

  return {
    id,
    firstName: sanitizeString(rawContact.firstName, 100),
    lastName: sanitizeString(rawContact.lastName, 100),
    email: rawContact.email && isValidEmail(rawContact.email) ? sanitizeString(rawContact.email, 255) : null,
    phone: sanitizePhone(rawContact.phone),
    orgname,
    tags: contactTags[id] || [],
    utm_source: utm.utm_source,
    utm_campaign: utm.utm_campaign,
    utm_medium: utm.utm_medium,
    utm_conjunto: utm.utm_conjunto,
  };
}

async function mergeFieldValuesIntoUtmMap(
  fieldValues: any[],
  fieldIdToUtm: Record<string, UtmColumn>,
  utmByContactId: Record<string, UtmFields>,
  acUrl: string,
  acApiKey: string,
  fallbackContactId?: string,
): Promise<void> {
  for (const fv of fieldValues) {
    const contactId = fv.contact != null
      ? String(fv.contact)
      : (fv.owner != null ? String(fv.owner) : fallbackContactId);
    const rawField = fv.field;
    const fieldId = rawField != null
      ? (typeof rawField === 'object' && rawField !== null && 'id' in rawField
        ? String((rawField as { id: unknown }).id)
        : String(rawField))
      : null;
    if (!contactId || !fieldId) continue;
    let col = fieldIdToUtm[fieldId];
    if (!col) {
      col = await resolveUtmColumnForFieldId(fieldId, acUrl, acApiKey, fieldIdToUtm);
    }
    if (!col) continue;
    const val = sanitizeUtmValue(fv.value, UTM_MAX);
    if (!utmByContactId[contactId]) utmByContactId[contactId] = emptyUtm();
    if (val) utmByContactId[contactId][col] = val;
  }
}

/** List contacts (date filter). Sideload fieldValues is unreliable — use fetchContactFieldValuesBatched. */
async function fetchAllContacts(acUrl: string, acApiKey: string): Promise<any[]> {
  const allContacts: any[] = [];
  let offset = 0;
  const limit = 100;
  const minDate = '2025-12-01T00:00:00-03:00';

  while (true) {
    console.log(`Fetching contacts offset=${offset}...`);
    const response = await fetch(
      `${acUrl}/api/3/contacts?limit=${limit}&offset=${offset}&orders[cdate]=DESC&filters[created_after]=${encodeURIComponent(minDate)}`,
      { headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' } },
    );

    if (!response.ok) {
      console.error('AC API error at offset', offset, await response.text());
      break;
    }

    const data = await response.json();
    const contacts = data.contacts || [];
    allContacts.push(...contacts);

    if (contacts.length < limit) break;
    offset += limit;
  }

  return allContacts;
}

/**
 * GET /contacts/:id/fieldValues for many contact IDs (deduplicated).
 */
async function fetchContactFieldValuesForIds(
  contactIds: string[],
  acUrl: string,
  acApiKey: string,
  fieldIdToUtm: Record<string, UtmColumn>,
  utmByContactId: Record<string, UtmFields>,
): Promise<void> {
  const unique = [...new Set(contactIds.map((id) => String(id)).filter(Boolean))];
  const batchSize = 10;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    await Promise.all(batch.map(async (id) => {
      try {
        const r = await fetch(
          `${acUrl}/api/3/contacts/${encodeURIComponent(id)}/fieldValues`,
          { headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' } },
        );
        if (r.status === 404) return;
        if (!r.ok) {
          console.error(`fieldValues HTTP ${r.status} for contact ${id}`);
          return;
        }
        const data = await r.json();
        await mergeFieldValuesIntoUtmMap(
          data.fieldValues || [],
          fieldIdToUtm,
          utmByContactId,
          acUrl,
          acApiKey,
          id,
        );
      } catch (e) {
        console.error(`fieldValues error for contact ${id}:`, e);
      }
    }));
  }
}

/** GA / visit tracking on contactDatum — preenche UTM quando campos customizados estão vazios */
async function mergeContactDatumForIds(
  contactIds: string[],
  acUrl: string,
  acApiKey: string,
  utmByContactId: Record<string, UtmFields>,
): Promise<void> {
  const unique = [...new Set(contactIds.map((id) => String(id)).filter(Boolean))];
  const batchSize = 10;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    await Promise.all(batch.map(async (id) => {
      try {
        const r = await fetch(
          `${acUrl}/api/3/contacts/${encodeURIComponent(id)}/contactData`,
          { headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' } },
        );
        if (!r.ok) return;
        const data = await r.json();
        const d = data.contactDatum;
        if (!d || typeof d !== 'object') return;
        if (!utmByContactId[id]) utmByContactId[id] = emptyUtm();
        const u = utmByContactId[id];
        if (!u.utm_source) {
          const v = sanitizeUtmValue(d.ga_campaign_source, UTM_MAX);
          if (v) u.utm_source = v;
        }
        if (!u.utm_campaign) {
          const v = sanitizeUtmValue(d.ga_campaign_name, UTM_MAX);
          if (v) u.utm_campaign = v;
        }
        if (!u.utm_medium) {
          const v = sanitizeUtmValue(d.ga_campaign_medium, UTM_MAX);
          if (v) u.utm_medium = v;
        }
        if (!u.utm_conjunto) {
          const seg = d.ga_campaign_customsegment || d.ga_campaign_content || d.ga_campaign_term;
          const v = sanitizeUtmValue(seg, UTM_MAX);
          if (v) u.utm_conjunto = v;
        }
      } catch (e) {
        console.error(`contactData error for contact ${id}:`, e);
      }
    }));
  }
}

/**
 * ActiveCampaign often omits fieldValues when using include= on list contacts.
 * Official approach: GET /contacts/:id/fieldValues per contact.
 */
async function fetchContactFieldValuesBatched(
  contacts: any[],
  acUrl: string,
  acApiKey: string,
  fieldIdToUtm: Record<string, UtmColumn>,
): Promise<Record<string, UtmFields>> {
  const utmByContactId: Record<string, UtmFields> = {};
  const ids = contacts.map((c) => String(c.id));
  await fetchContactFieldValuesForIds(ids, acUrl, acApiKey, fieldIdToUtm, utmByContactId);

  const withAny = Object.keys(utmByContactId).filter((cid) => {
    const u = utmByContactId[cid];
    return !!(u.utm_source || u.utm_campaign || u.utm_medium || u.utm_conjunto);
  }).length;
  console.log(`Per-contact fieldValues: ${contacts.length} contacts, ${withAny} with mapped UTM data`);

  return utmByContactId;
}

async function fetchContactTags(contacts: any[], acUrl: string, acApiKey: string): Promise<Record<string, string[]>> {
  const contactTags: Record<string, string[]> = {};
  const tagNameCache: Record<string, string> = {};

  const batchSize = 10;
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);

    await Promise.all(batch.map(async (contact: any) => {
      const contactId = String(contact.id);
      try {
        const tagsResponse = await fetch(`${acUrl}/api/3/contacts/${contactId}/contactTags`, {
          headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
        });

        if (!tagsResponse.ok) return;

        const tagsData = await tagsResponse.json();
        const tagIds = (tagsData.contactTags || []).map((ct: any) => ct.tag);

        const tagNames: string[] = [];
        for (const tagId of tagIds) {
          if (tagNameCache[tagId]) {
            tagNames.push(tagNameCache[tagId]);
            continue;
          }

          const tagResponse = await fetch(`${acUrl}/api/3/tags/${tagId}`, {
            headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
          });

          if (tagResponse.ok) {
            const tagData = await tagResponse.json();
            if (tagData.tag?.tag) {
              const name = sanitizeString(tagData.tag.tag, 100);
              tagNameCache[tagId] = name;
              tagNames.push(name);
            }
          }
        }

        contactTags[contactId] = tagNames;
      } catch (e) {
        console.error(`Error fetching tags for contact ${contactId}:`, e);
      }
    }));
  }

  return contactTags;
}

async function fetchOrgNames(contacts: any[], acUrl: string, acApiKey: string): Promise<Record<string, string>> {
  const orgNames: Record<string, string> = {};
  const orgIds = new Set<string>();

  for (const contact of contacts) {
    if (contact.orgid && String(contact.orgid) !== '0' && !contact.orgname) {
      orgIds.add(String(contact.orgid));
    }
  }

  console.log(`Fetching ${orgIds.size} organization names...`);

  const batchSize = 10;
  const orgIdArray = Array.from(orgIds);
  for (let i = 0; i < orgIdArray.length; i += batchSize) {
    const batch = orgIdArray.slice(i, i + batchSize);
    await Promise.all(batch.map(async (orgId) => {
      try {
        const response = await fetch(`${acUrl}/api/3/organizations/${orgId}`, {
          headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.organization?.name) {
            orgNames[orgId] = sanitizeString(data.organization.name, 200);
          }
        }
      } catch (e) {
        console.error(`Error fetching org ${orgId}:`, e);
      }
    }));
  }

  return orgNames;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    fieldUtmResolveCache.clear();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Credenciais: .env na raiz → npm run ac:secrets (Supabase) ou npm run ac:serve (local)
    const acApiKey = Deno.env.get('ACTIVECAMPAIGN_API_KEY');
    const acUrlRaw = Deno.env.get('ACTIVECAMPAIGN_URL');
    const acUrl = acUrlRaw ? normalizeAcApiUrl(acUrlRaw) : '';

    if (!acApiKey || !acUrl) {
      console.error('ActiveCampaign credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de integração não configurado' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pré-valida a sessão Supabase (mesmo critério usado depois no fluxo de sync) — para debug e sync.
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);

    // ---- DEBUG MODE -------------------------------------------------------
    // Permite inspecionar a integração sem rodar o sync inteiro.
    //   POST body: { debug: 'fields' }
    //                       { debug: 'contact', acId: '123' }
    //                       { debug: 'lead',    leadId: 'uuid' }   // resolve activecampaign_id do CRM
    // ----------------------------------------------------------------------
    let debugRequest: { mode?: string; acId?: string; leadId?: string } = {};
    let importContactAcId: string | undefined;
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        const body = await req.clone().json();
        if (body && typeof body === 'object' && body.action === 'importContact' && body.acId) {
          importContactAcId = String(body.acId).trim();
        }
        if (body && typeof body === 'object' && body.debug) {
          debugRequest = {
            mode: String(body.debug),
            acId: body.acId ? String(body.acId) : undefined,
            leadId: body.leadId ? String(body.leadId) : undefined,
          };
        }
      }
      const url = new URL(req.url);
      if (!debugRequest.mode && url.searchParams.has('debug')) {
        debugRequest = {
          mode: url.searchParams.get('debug') || undefined,
          acId: url.searchParams.get('acId') || undefined,
          leadId: url.searchParams.get('leadId') || undefined,
        };
      }
    } catch {
      /* ignore body parse errors */
    }

    async function fetchAcContactBundle(acId: string) {
      const [contactR, fvR, cdR] = await Promise.all([
        fetch(`${acUrl}/api/3/contacts/${encodeURIComponent(acId)}`, {
          headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
        }),
        fetch(`${acUrl}/api/3/contacts/${encodeURIComponent(acId)}/fieldValues`, {
          headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
        }),
        fetch(`${acUrl}/api/3/contacts/${encodeURIComponent(acId)}/contactData`, {
          headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
        }),
      ]);
      const { fields: allFieldsList } = await listAllFields(acUrl, acApiKey);
      const fieldsById: Record<string, { perstag: string; title: string }> = {};
      for (const f of allFieldsList) {
        const { perstag, title } = acFieldLabels(f);
        fieldsById[String(f.id)] = { perstag, title };
      }
      const fvJson = fvR.ok ? await fvR.json() : { fieldValues: [] };
      const rawFieldValues = Array.isArray(fvJson.fieldValues) ? fvJson.fieldValues : [];
      const fieldValuesAnnotated: { fieldId: string | null; fieldDef: { perstag: string; title: string } | null; value: unknown }[] = [];
      for (const fv of rawFieldValues) {
        const fieldId = fv.field != null
          ? (typeof fv.field === 'object' && fv.field !== null && 'id' in fv.field
            ? String((fv.field as { id: unknown }).id)
            : String(fv.field))
          : null;
        let fieldDef = fieldId ? fieldsById[fieldId] || null : null;
        if (fieldId && !fieldDef) {
          try {
            const fr = await fetch(`${acUrl}/api/3/fields/${encodeURIComponent(fieldId)}`, {
              headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
            });
            if (fr.ok) {
              const fd = await fr.json();
              if (fd.field) {
                fieldDef = {
                  perstag: String(fd.field.perstag || ''),
                  title: String(fd.field.title || ''),
                };
                fieldsById[fieldId] = fieldDef;
              }
            }
          } catch {
            /* ignore */
          }
        }
        fieldValuesAnnotated.push({ fieldId, fieldDef, value: fv.value ?? null });
      }
      const contactTags = await fetchContactTags(
        [{ id: acId }],
        acUrl,
        acApiKey,
      );
      return {
        contact: contactR.ok ? await contactR.json() : { error: await contactR.text() },
        contactHttpStatus: contactR.status,
        fieldValues: fieldValuesAnnotated,
        fieldValuesHttpStatus: fvR.status,
        contactData: cdR.ok ? await cdR.json() : { error: await cdR.text() },
        tags: contactTags[acId] || [],
      };
    }

    async function mapAcBundleToLeadPayload(bundle: {
      contact: any;
      fieldValues: any[];
      contactData: any;
      tags: string[];
    }): Promise<Record<string, unknown>> {
      const c = bundle.contact?.contact;
      const out: Record<string, unknown> = {};
      if (c) {
        const fullName = `${sanitizeString(c.firstName, 100)} ${sanitizeString(c.lastName, 100)}`.trim();
        if (fullName) out.name = fullName.substring(0, 255);
        if (c.email && isValidEmail(c.email)) out.email = sanitizeString(c.email, 255);
        const phone = sanitizePhone(c.phone);
        if (phone) out.whatsapp = phone;
        const org = sanitizeString(c.orgname, 200);
        if (org) out.company = org;
        if (c.id != null) out.activecampaign_id = String(c.id);
      }

      const { map: fieldIdToUtm } = await fetchFieldIdToUtmColumn(acUrl, acApiKey);
      const contactId = c?.id != null ? String(c.id) : '';
      const utmByContactId: Record<string, UtmFields> = {};
      await mergeFieldValuesIntoUtmMap(
        (bundle.fieldValues || []).map((fv: any) => ({
          contact: contactId,
          field: fv.fieldId,
          value: fv.value,
        })),
        fieldIdToUtm,
        utmByContactId,
        acUrl,
        acApiKey,
        contactId,
      );
      const utm = contactId ? (utmByContactId[contactId] ?? emptyUtm()) : emptyUtm();
      if (utm.utm_source) out.utm_source = utm.utm_source;
      if (utm.utm_campaign) out.utm_campaign = utm.utm_campaign;
      if (utm.utm_medium) out.utm_medium = utm.utm_medium;
      if (utm.utm_conjunto) out.utm_conjunto = utm.utm_conjunto;

      const cd = bundle.contactData?.contactDatum || bundle.contactData;
      if (cd && typeof cd === 'object') {
        if (!out.utm_source) {
          const v = sanitizeUtmValue(cd.ga_campaign_source, UTM_MAX);
          if (v) out.utm_source = v;
        }
        if (!out.utm_campaign) {
          const v = sanitizeUtmValue(cd.ga_campaign_name, UTM_MAX);
          if (v) out.utm_campaign = v;
        }
        if (!out.utm_medium) {
          const v = sanitizeUtmValue(cd.ga_campaign_medium, UTM_MAX);
          if (v) out.utm_medium = v;
        }
        if (!out.utm_conjunto) {
          const seg = cd.ga_campaign_customsegment || cd.ga_campaign_content || cd.ga_campaign_term;
          const v = sanitizeUtmValue(seg, UTM_MAX);
          if (v) out.utm_conjunto = v;
        }
      }
      if (bundle.tags?.length && !out.confection_type) {
        out.confection_type = bundle.tags[0];
      }
      return out;
    }

    if (importContactAcId) {
      if (claimsError || !claimsData?.user) {
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const userId = claimsData.user.id;
      const bundle = await fetchAcContactBundle(importContactAcId);
      if (bundle.contact?.error) {
        return new Response(
          JSON.stringify({ error: 'Contato não encontrado no ActiveCampaign', detail: bundle.contact.error }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const mapped = await mapAcBundleToLeadPayload(bundle);
      const { data: existing } = await adminSupabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('activecampaign_id', importContactAcId)
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await adminSupabase
          .from('leads')
          .update(mapped)
          .eq('id', existing.id);
        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ success: true, action: 'updated', leadId: existing.id, acId: importContactAcId, mapped, bundle }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const insertRow = {
        user_id: userId,
        stage: 'prospeccao',
        temperature: 'frio',
        is_new: true,
        lead_source: 'marketing',
        value: 0,
        implementation_value: 0,
        monthly_value: 0,
        entry_date: new Date().toISOString(),
        last_contact: new Date().toISOString(),
        history: [{
          type: 'sistema',
          note: `Lead importado do ActiveCampaign (contato ${importContactAcId}) em ${new Date().toLocaleDateString('pt-BR')}`,
          date: new Date().toISOString(),
          user: 'Sistema',
        }],
        ...mapped,
        name: mapped.name || mapped.email || 'Sem nome',
      };
      const { data: created, error: insErr } = await adminSupabase
        .from('leads')
        .insert(insertRow)
        .select('id')
        .single();
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ success: true, action: 'created', leadId: created?.id, acId: importContactAcId, mapped, bundle }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (debugRequest.mode) {
      // Debug exige usuário autenticado (mesma porta de entrada da UI)
      if (claimsError || !claimsData?.user) {
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.log('Debug mode:', debugRequest, 'user:', claimsData.user.id);

      if (debugRequest.mode === 'fields') {
        const { fields: all, lastStatus, lastError } = await listAllFields(acUrl, acApiKey);
        const { map: fieldMap } = await fetchFieldIdToUtmColumn(acUrl, acApiKey);
        const mapped = buildMappedFieldsByColumn(fieldMap, all);
        const probe = await probeAcApi(acUrl, acApiKey);
        const utmLike = all.filter((f: any) => {
          const { perstag, title } = acFieldLabels(f);
          const hay = `${perstag} ${title}`.toLowerCase();
          return hay.includes('utm') || hay.includes('conjunto') || hay.includes('campanha');
        });
        return new Response(
          JSON.stringify({
            success: true,
            mode: 'fields',
            total: all.length,
            fields_api_status: lastStatus,
            fields_api_error: lastError,
            ac_probe: probe,
            mapped_utm_fields: mapped,
            utm_like_fields: utmLike.map((f: any) => {
              const { perstag, title } = acFieldLabels(f);
              return { id: String(f.id), title, perstag, type: f.type, relation: f.relation };
            }),
            fields: all.map((f: any) => {
              const { perstag, title } = acFieldLabels(f);
              return {
                id: String(f.id ?? ''),
                title,
                perstag,
                type: String(f.type ?? ''),
                relation: f.relation ?? null,
              };
            }),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      let acId = debugRequest.acId;
      if (debugRequest.mode === 'lead' && debugRequest.leadId) {
        const { data: lead } = await adminSupabase
          .from('leads')
          .select('activecampaign_id, name, email, whatsapp')
          .eq('id', debugRequest.leadId)
          .maybeSingle();
        if (!lead) {
          return new Response(JSON.stringify({ error: 'Lead não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        acId = lead.activecampaign_id ? String(lead.activecampaign_id) : undefined;
        if (!acId) {
          return new Response(
            JSON.stringify({ success: true, mode: 'lead', message: 'Lead não tem activecampaign_id', lead }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      if (debugRequest.mode === 'contact' || debugRequest.mode === 'lead') {
        if (!acId) {
          return new Response(JSON.stringify({ error: 'acId obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const bundle = await fetchAcContactBundle(acId);
        const contactObj = bundle.contact?.contact;
        if (!contactObj && bundle.contact?.error) {
          return new Response(
            JSON.stringify({
              error: 'Contato não encontrado no ActiveCampaign',
              acId,
              contactHttpStatus: bundle.contactHttpStatus,
              detail: String(bundle.contact.error).slice(0, 500),
              hint: bundle.contactHttpStatus === 404
                ? 'Verifique o ID do link e se ACTIVECAMPAIGN_URL aponta para a mesma conta (*.api-us1.com).'
                : 'Verifique ACTIVECAMPAIGN_API_KEY e rode npm run ac:secrets após alterar o .env.',
            }),
            { status: bundle.contactHttpStatus === 404 ? 404 : 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            success: true,
            mode: debugRequest.mode,
            acId,
            contact: bundle.contact,
            fieldValues: bundle.fieldValues,
            contactData: bundle.contactData,
            tags: bundle.tags,
            contactHttpStatus: bundle.contactHttpStatus,
            fieldValuesHttpStatus: bundle.fieldValuesHttpStatus,
            mapped: await mapAcBundleToLeadPayload(bundle),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ error: 'debug inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ---- END DEBUG MODE ---------------------------------------------------

    let userIds: string[] = [];

    if (!claimsError && claimsData?.user) {
      const authUserId = claimsData.user.id;
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (profile?.role === 'Gestor') {
        const { data: relations } = await adminSupabase
          .from('manager_sdr_relations')
          .select('sdr_id')
          .eq('manager_id', authUserId);
        const sdrIds = (relations || []).map((r: { sdr_id: string }) => r.sdr_id);
        userIds = [...new Set([authUserId, ...sdrIds])];
        console.log(`Gestor sync for ${userIds.length} user(s)`);
      } else {
        userIds = [authUserId];
        console.log(`Authenticated sync for user ${userIds[0]}`);
      }
    } else {
      const cronSecret = Deno.env.get('CRON_SECRET');
      if (!cronSecret || token !== cronSecret) {
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.log('Cron sync: fetching all user IDs with leads...');
      const { data: users } = await adminSupabase
        .from('leads')
        .select('user_id')
        .eq('lead_source', 'marketing')
        .limit(1000);

      userIds = [...new Set((users || []).map((u: any) => u.user_id))];

      if (userIds.length === 0) {
        const { data: profiles } = await adminSupabase
          .from('profiles')
          .select('user_id')
          .eq('role', 'SDR');
        userIds = (profiles || []).map((p: any) => p.user_id);
      }

      console.log(`Cron sync for ${userIds.length} users`);
    }

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Fetching AC field definitions for UTM mapping...');
    const { map: fieldIdToUtm, raw: allAcFields, fieldsMeta } = await fetchFieldIdToUtmColumn(
      acUrl,
      acApiKey,
    );
    const acProbe = await probeAcApi(acUrl, acApiKey);

    console.log('Fetching all contacts from ActiveCampaign...');
    const contacts = await fetchAllContacts(acUrl, acApiKey);
    console.log(`Found ${contacts.length} total contacts`);

    if (Object.keys(fieldIdToUtm).length === 0 && contacts.length > 0) {
      console.warn('Nenhum UTM em /fields — tentando descobrir pelos fieldValues dos contatos...');
      await discoverUtmFieldsFromContactSamples(
        contacts.map((c: any) => String(c.id)),
        acUrl,
        acApiKey,
        fieldIdToUtm,
        80,
      );
    }

    let mappedFieldsByColumn = buildMappedFieldsByColumn(fieldIdToUtm, allAcFields);
    if (Object.keys(fieldIdToUtm).length === 0) {
      console.warn(
        'Nenhum campo AC mapeado para UTM. Confira títulos no AC ou defina secret ACTIVECAMPAIGN_UTM_FIELD_IDS.',
      );
    }

    console.log('Fetching custom field values (UTM) per contact...');
    const utmByContactId = await fetchContactFieldValuesBatched(contacts, acUrl, acApiKey, fieldIdToUtm);

    if (Object.keys(mappedFieldsByColumn).length === 0 && Object.keys(fieldIdToUtm).length > 0) {
      mappedFieldsByColumn = buildMappedFieldsByColumn(fieldIdToUtm, allAcFields);
    }

    const { data: linkedLeads } = await adminSupabase
      .from('leads')
      .select('activecampaign_id')
      .in('user_id', userIds)
      .not('activecampaign_id', 'is', null);

    const fromList = new Set(contacts.map((c: any) => String(c.id)));
    const fromDb = [...new Set((linkedLeads || []).map((l: any) => String(l.activecampaign_id)).filter(Boolean))];
    const onlyInDb = fromDb.filter((id) => !fromList.has(id)).slice(0, 2500);
    if (onlyInDb.length > 0) {
      console.log(
        `Fetching UTM for ${onlyInDb.length} leads já no CRM (ActiveCampaign ID fora da lista filtrada por data)...`,
      );
      await fetchContactFieldValuesForIds(onlyInDb, acUrl, acApiKey, fieldIdToUtm, utmByContactId);
    }

    const forDatum = [...new Set([...contacts.map((c: any) => String(c.id)), ...fromDb])].slice(0, 2500);
    await mergeContactDatumForIds(forDatum, acUrl, acApiKey, utmByContactId);

    const totalWithUtm = Object.values(utmByContactId).filter((u) =>
      u.utm_source || u.utm_campaign || u.utm_medium || u.utm_conjunto
    ).length;
    console.log(`UTM map: ${Object.keys(utmByContactId).length} contatos com dados brutos, ${totalWithUtm} com algum UTM preenchido`);

    console.log('Fetching tags...');
    const contactTags = await fetchContactTags(contacts, acUrl, acApiKey);
    console.log('Tags fetched');

    console.log('Fetching organization names...');
    const orgNames = await fetchOrgNames(contacts, acUrl, acApiKey);
    console.log(`Fetched ${Object.keys(orgNames).length} org names`);

    let totalImported = 0;
    let totalUtmUpdates = 0;
    let totalDbErrors = 0;
    let validationErrors = 0;

    for (const userId of userIds) {
      const { data: existingLeads } = await adminSupabase
        .from('leads')
        .select('activecampaign_id')
        .eq('user_id', userId)
        .not('activecampaign_id', 'is', null);

      const existingAcIds = new Set((existingLeads || []).map((l: any) => String(l.activecampaign_id)));
      console.log(`User ${userId}: ${existingAcIds.size} existing AC leads`);

      const leadsToInsert: any[] = [];
      const utmUpdatesForUser: { acId: string; utm: UtmFields }[] = [];
      const utmUpdateQueued = new Set<string>();

      for (const contact of contacts) {
        const validated = validateContact(contact, contactTags, orgNames, utmByContactId);
        if (!validated) {
          if (userId === userIds[0]) validationErrors++;
          continue;
        }

        const utmPayload: UtmFields = {
          utm_source: validated.utm_source,
          utm_campaign: validated.utm_campaign,
          utm_medium: validated.utm_medium,
          utm_conjunto: validated.utm_conjunto,
        };

        if (existingAcIds.has(validated.id)) {
          if (
            utmPayload.utm_source || utmPayload.utm_campaign || utmPayload.utm_medium ||
            utmPayload.utm_conjunto
          ) {
            utmUpdatesForUser.push({ acId: validated.id, utm: utmPayload });
            utmUpdateQueued.add(validated.id);
          }
          continue;
        }

        const fullName = `${validated.firstName} ${validated.lastName}`.trim();
        const tagsNote = validated.tags.length > 0 ? ` | Tags: ${validated.tags.join(', ')}` : '';

        leadsToInsert.push({
          user_id: userId,
          name: fullName.substring(0, 255) || validated.email || 'Sem nome',
          email: validated.email,
          whatsapp: validated.phone,
          company: validated.orgname,
          confection_type: validated.tags.length > 0 ? validated.tags[0] : null,
          stage: 'prospeccao',
          temperature: 'frio',
          is_new: true,
          activecampaign_id: validated.id,
          lead_source: 'marketing',
          value: 0,
          utm_source: utmPayload.utm_source,
          utm_campaign: utmPayload.utm_campaign,
          utm_medium: utmPayload.utm_medium,
          utm_conjunto: utmPayload.utm_conjunto,
          history: [{
            type: 'sistema',
            note: `Lead importado do ActiveCampaign em ${new Date().toLocaleDateString('pt-BR')}${tagsNote}`,
            date: new Date().toISOString(),
            user: 'Sistema',
          }],
        });
      }

      // Leads já no CRM cujo contato NÃO entrou na lista filtrada do AC — mesmo assim temos UTM em utmByContactId
      const { data: userAcLeads } = await adminSupabase
        .from('leads')
        .select('activecampaign_id')
        .eq('user_id', userId)
        .not('activecampaign_id', 'is', null);

      for (const row of userAcLeads || []) {
        const acId = String(row.activecampaign_id ?? '').trim();
        if (!acId) continue;
        const utm = utmByContactId[acId];
        if (!utm) continue;
        if (!(utm.utm_source || utm.utm_campaign || utm.utm_medium || utm.utm_conjunto)) continue;
        if (utmUpdateQueued.has(acId)) continue;
        utmUpdatesForUser.push({
          acId,
          utm: {
            utm_source: utm.utm_source,
            utm_campaign: utm.utm_campaign,
            utm_medium: utm.utm_medium,
            utm_conjunto: utm.utm_conjunto,
          },
        });
        utmUpdateQueued.add(acId);
      }

      console.log(`User ${userId}: ${leadsToInsert.length} new leads to insert, ${utmUpdatesForUser.length} UTM refreshes`);

      for (let i = 0; i < leadsToInsert.length; i += 50) {
        const batch = leadsToInsert.slice(i, i + 50);
        const { error: insertError } = await adminSupabase
          .from('leads')
          .insert(batch);

        if (insertError) {
          console.error('Batch insert error:', insertError.message);
          totalDbErrors += batch.length;
        } else {
          totalImported += batch.length;
        }
      }

      const chunk = 20;
      for (let i = 0; i < utmUpdatesForUser.length; i += chunk) {
        const slice = utmUpdatesForUser.slice(i, i + chunk);
        const results = await Promise.all(slice.map(async ({ acId, utm }) => {
          const { error } = await adminSupabase
            .from('leads')
            .update({
              utm_source: utm.utm_source,
              utm_campaign: utm.utm_campaign,
              utm_medium: utm.utm_medium,
              utm_conjunto: utm.utm_conjunto,
            })
            .eq('user_id', userId)
            .eq('activecampaign_id', acId);
          if (error) console.error('UTM update failed', userId, acId, error.message);
          return !error;
        }));
        totalUtmUpdates += results.filter(Boolean).length;
        if (results.some((ok) => !ok)) {
          console.error('Some UTM batch updates failed for user', userId);
        }
      }
    }

    console.log(`Done: ${totalImported} imported, ${totalUtmUpdates} UTM updates`);

    const utmCounts = { utm_source: 0, utm_campaign: 0, utm_medium: 0, utm_conjunto: 0 };
    for (const u of Object.values(utmByContactId)) {
      if (u.utm_source) utmCounts.utm_source++;
      if (u.utm_campaign) utmCounts.utm_campaign++;
      if (u.utm_medium) utmCounts.utm_medium++;
      if (u.utm_conjunto) utmCounts.utm_conjunto++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: totalImported,
        utm_updates: totalUtmUpdates,
        total: contacts.length,
        users: userIds.length,
        utm_diagnostics: {
          mapped_fields: mappedFieldsByColumn,
          contacts_with_any_utm: totalWithUtm,
          contacts_with: utmCounts,
          total_ac_fields_seen: allAcFields.length,
          fields_api_status: fieldsMeta.lastStatus,
          fields_api_error: fieldsMeta.lastError,
          ac_probe: acProbe,
        },
        errors: (validationErrors + totalDbErrors > 0)
          ? `${validationErrors} validação, ${totalDbErrors} banco de dados`
          : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in sync-activecampaign:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar sincronização' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
