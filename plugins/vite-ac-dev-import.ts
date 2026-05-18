/**
 * Dev only: busca contato AC usando ACTIVECAMPAIGN_* do .env (sem Supabase Secrets).
 * GET /api/ac-import/:contactId
 */
import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';
import { fieldToUtmColumn } from '../src/lib/activecampaignMap';

function normalizeAcUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, '');
  url = url.replace(/\/api\/3\/?$/i, '');
  const hosted = url.match(/^https?:\/\/([^.]+)\.activehosted\.com/i);
  if (hosted) {
    const region = process.env.ACTIVECAMPAIGN_API_REGION?.trim() || 'us1';
    url = `https://${hosted[1]}.api-${region}.com`;
  }
  return url;
}

async function acFetchJson(url: string, apiKey: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const r = await fetch(url, {
    headers: { 'Api-Token': apiKey, 'Content-Type': 'application/json' },
  });
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    data = { error: await r.text() };
  }
  return { ok: r.ok, status: r.status, data };
}

export function viteAcDevImport(): Plugin {
  return {
    name: 'vite-ac-dev-import',
    configureServer(server) {
      const handler: Connect.NextHandleFunction = async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const match = url.match(/^\/api\/ac-import\/(\d+)\/?$/);
        if (!match) {
          next();
          return;
        }

        const acId = match[1];
        const env = loadEnv(server.config.mode, server.config.root, '');
        const acUrl = normalizeAcUrl(env.ACTIVECAMPAIGN_URL || '');
        const apiKey = env.ACTIVECAMPAIGN_API_KEY || '';

        res.setHeader('Content-Type', 'application/json');

        if (!acUrl || !apiKey) {
          res.statusCode = 503;
          res.end(
            JSON.stringify({
              error: 'ACTIVECAMPAIGN_URL e ACTIVECAMPAIGN_API_KEY ausentes no .env da raiz do projeto.',
            }),
          );
          return;
        }

        try {
          const [contactR, fvR] = await Promise.all([
            acFetchJson(`${acUrl}/api/3/contacts/${encodeURIComponent(acId)}`, apiKey),
            acFetchJson(`${acUrl}/api/3/contacts/${encodeURIComponent(acId)}/fieldValues`, apiKey),
          ]);

          if (!contactR.ok) {
            res.statusCode = contactR.status === 404 ? 404 : 502;
            res.end(
              JSON.stringify({
                error: 'Contato não encontrado no ActiveCampaign',
                contactHttpStatus: contactR.status,
                detail: contactR.data,
                hint: `URL API: ${acUrl}`,
              }),
            );
            return;
          }

          const contact = contactR.data as { contact?: Record<string, unknown> };
          const fvPayload = fvR.data as { fieldValues?: { field: unknown; value: unknown }[] };
          const rawFvs = Array.isArray(fvPayload.fieldValues) ? fvPayload.fieldValues : [];

          const fieldCache = new Map<string, { perstag: string; title: string }>();
          const fieldValues: {
            fieldId: string | null;
            fieldDef: { perstag: string; title: string } | null;
            value: unknown;
          }[] = [];

          for (const fv of rawFvs) {
            const fieldId =
              fv.field != null && typeof fv.field === 'object' && fv.field !== null && 'id' in fv.field
                ? String((fv.field as { id: unknown }).id)
                : fv.field != null
                  ? String(fv.field)
                  : null;

            let fieldDef = fieldId ? fieldCache.get(fieldId) ?? null : null;
            if (fieldId && !fieldDef) {
              const fr = await acFetchJson(`${acUrl}/api/3/fields/${encodeURIComponent(fieldId)}`, apiKey);
              const fd = fr.data as { field?: { perstag?: string; title?: string } };
              if (fd?.field) {
                fieldDef = {
                  perstag: String(fd.field.perstag || ''),
                  title: String(fd.field.title || ''),
                };
                fieldCache.set(fieldId, fieldDef);
              }
            }
            fieldValues.push({ fieldId, fieldDef: fieldDef ?? null, value: fv.value ?? null });
          }

          const mapped: Record<string, string> = {};
          for (const fv of fieldValues) {
            const def = fv.fieldDef;
            if (!def || fv.value == null) continue;
            const col = fieldToUtmColumn(def.perstag, def.title);
            if (col) mapped[col] = String(fv.value).trim().substring(0, 2000);
          }

          const c = contact.contact;
          if (c) {
            const first = String(c.firstName || '').trim();
            const last = String(c.lastName || '').trim();
            const name = `${first} ${last}`.trim();
            if (name) mapped.name = name;
            if (c.email) mapped.email = String(c.email);
            if (c.phone) mapped.whatsapp = String(c.phone);
            if (c.orgname) mapped.company = String(c.orgname);
            mapped.activecampaign_id = acId;
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              source: 'dev-env',
              acId,
              contact,
              fieldValues,
              tags: [] as string[],
              mapped,
            }),
          );
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro ao consultar ActiveCampaign' }));
        }
      };

      server.middlewares.use(handler);
    },
  };
}
