import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UTM_MAX = 2000;

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

/** Map ActiveCampaign field perstag/title to CRM column (alphanumeric only for exact keys) */
function fieldToUtmColumn(perstag: string, title: string): UtmColumn | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const keys = [norm(perstag || ''), norm(title || '')].filter(Boolean);
  const map: Record<string, UtmColumn> = {
    utmsource: 'utm_source',
    utmcampaign: 'utm_campaign',
    utmmedium: 'utm_medium',
    utmconjunto: 'utm_conjunto',
  };
  for (const k of keys) {
    if (map[k]) return map[k];
  }
  const hay = `${perstag} ${title}`.toLowerCase();
  if (!hay.includes('utm')) return null;
  if (hay.includes('conjunto') || hay.includes('adset')) return 'utm_conjunto';
  if (hay.includes('campaign') || hay.includes('campanha')) return 'utm_campaign';
  if (hay.includes('medium') || hay.includes('meio')) return 'utm_medium';
  if (hay.includes('source') || hay.includes('origem')) return 'utm_source';
  return null;
}

async function fetchFieldIdToUtmColumn(acUrl: string, acApiKey: string): Promise<Record<string, UtmColumn>> {
  const out: Record<string, UtmColumn> = {};
  let offset = 0;
  const limit = 100;
  while (true) {
    const response = await fetch(
      `${acUrl}/api/3/fields?limit=${limit}&offset=${offset}`,
      { headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' } },
    );
    if (!response.ok) {
      console.error('AC fields API error', await response.text());
      break;
    }
    const data = await response.json();
    const fields = data.fields || [];
    for (const f of fields) {
      const col = fieldToUtmColumn(String(f.perstag || ''), String(f.title || ''));
      if (col && f.id != null) out[String(f.id)] = col;
    }
    if (fields.length < limit) break;
    offset += limit;
  }
  console.log(`Mapped ${Object.keys(out).length} ActiveCampaign custom fields to UTM columns`);
  return out;
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

function mergeFieldValuesIntoUtmMap(
  fieldValues: any[],
  fieldIdToUtm: Record<string, UtmColumn>,
  utmByContactId: Record<string, UtmFields>,
  fallbackContactId?: string,
): void {
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
    const col = fieldIdToUtm[fieldId];
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
        mergeFieldValuesIntoUtmMap(data.fieldValues || [], fieldIdToUtm, utmByContactId, id);
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const acApiKey = Deno.env.get('ACTIVECAMPAIGN_API_KEY');
    const acUrl = Deno.env.get('ACTIVECAMPAIGN_URL');

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

    let userIds: string[] = [];
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);

    if (!claimsError && claimsData?.user) {
      userIds = [claimsData.user.id];
      console.log(`Authenticated sync for user ${userIds[0]}`);
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
    const fieldIdToUtm = await fetchFieldIdToUtmColumn(acUrl, acApiKey);
    if (Object.keys(fieldIdToUtm).length === 0) {
      console.warn(
        'Nenhum campo AC mapeado para UTM (perstag/título com utm_*). Confira os nomes dos campos personalizados no ActiveCampaign.',
      );
    }

    console.log('Fetching all contacts from ActiveCampaign...');
    const contacts = await fetchAllContacts(acUrl, acApiKey);
    console.log(`Found ${contacts.length} total contacts`);

    console.log('Fetching custom field values (UTM) per contact...');
    const utmByContactId = await fetchContactFieldValuesBatched(contacts, acUrl, acApiKey, fieldIdToUtm);

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

      const existingAcIds = new Set((existingLeads || []).map((l: any) => l.activecampaign_id));
      console.log(`User ${userId}: ${existingAcIds.size} existing AC leads`);

      const leadsToInsert: any[] = [];
      const utmUpdatesForUser: { acId: string; utm: UtmFields }[] = [];

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
          return !error;
        }));
        totalUtmUpdates += results.filter(Boolean).length;
        if (results.some((ok) => !ok)) {
          console.error('Some UTM batch updates failed for user', userId);
        }
      }
    }

    console.log(`Done: ${totalImported} imported, ${totalUtmUpdates} UTM updates`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: totalImported,
        utm_updates: totalUtmUpdates,
        total: contacts.length,
        users: userIds.length,
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
