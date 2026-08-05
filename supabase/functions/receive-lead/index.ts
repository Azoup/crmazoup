import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    normalized[k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")] = v;
  }
  for (const key of keys) {
    const nk = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const v = normalized[nk];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function onlyDigits(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const keys = [Deno.env.get("LEADS_WEBHOOK_KEY"), Deno.env.get("N8N_API_KEY")].filter(
      (k): k is string => !!k,
    );
    if (keys.length === 0) return json({ error: "Serviço não configurado" }, 503);

    const auth = req.headers.get("Authorization") || "";
    const xKey = req.headers.get("x-api-key") || "";
    const ok = keys.some((k) => auth === `Bearer ${k}` || xKey === k);
    if (!ok) {
      return json({ error: "Não autorizado" }, 401);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const items = Array.isArray(raw) ? raw : [raw];
    if (items.length === 0 || items.length > 100) {
      return json({ error: "Envie de 1 a 100 leads por requisição" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Dono padrão: gestor aprovado mais antigo
    const { data: owners } = await supabase
      .from("profiles")
      .select("user_id, role, approved, created_at")
      .eq("approved", true)
      .order("created_at", { ascending: true });

    const defaultOwner =
      owners?.find((o) => o.role === "Gestor")?.user_id || owners?.[0]?.user_id || null;

    if (!defaultOwner) return json({ error: "Nenhum usuário aprovado para receber leads" }, 503);

    const results: { name: string; status: string; lead_id?: string; error?: string }[] = [];

    for (const item of items) {
      if (!item || typeof item !== "object") {
        results.push({ name: "?", status: "ignorado", error: "item inválido" });
        continue;
      }
      const p = item as Record<string, unknown>;

      const name = pick(p, ["Nome Completo", "nome", "name", "full_name"]);
      const whatsapp = onlyDigits(pick(p, ["WhatsApp", "whatsapp", "telefone", "phone", "celular"]));
      const email = pick(p, ["E-mail Profissional", "email", "e-mail", "email_profissional"]);

      if (!name && !whatsapp && !email) {
        results.push({ name: "?", status: "ignorado", error: "sem nome/whatsapp/email" });
        continue;
      }

      const company = pick(p, ["Nome da Confecção", "empresa", "company"]);
      const segmento = pick(p, ["Segmento", "segment"]);
      const tipoProducao = pick(p, ["Tipo de Produção", "tipo_producao"]);
      const usuarios = pick(p, ["Quantidade de Usuários", "quantidade_usuarios"]);
      const dificuldade = pick(p, ["Principal Dificuldade", "dificuldade", "pain"]);
      const formName = pick(p, ["form_name", "Formulário", "formulario"]);
      const formId = pick(p, ["form_id"]);

      const observations = [
        segmento && `Segmento: ${segmento}`,
        tipoProducao && `Tipo de produção: ${tipoProducao}`,
        usuarios && `Quantidade de usuários: ${usuarios}`,
        formName && `Formulário: ${formName}${formId ? ` (${formId})` : ""}`,
      ]
        .filter(Boolean)
        .join("\n");

      // Deduplicação por whatsapp ou email
      let existingId: string | null = null;
      if (whatsapp || email) {
        const filters: string[] = [];
        if (whatsapp) filters.push(`whatsapp.eq.${whatsapp}`);
        if (email) filters.push(`email.eq.${email}`);
        const { data: dup } = await supabase
          .from("leads")
          .select("id")
          .or(filters.join(","))
          .limit(1);
        existingId = dup?.[0]?.id ?? null;
      }

      const payload: Record<string, unknown> = {
        user_id: defaultOwner,
        name: (name || company || email || whatsapp)!.substring(0, 255),
        company: company?.substring(0, 200) ?? null,
        confection_type: segmento?.substring(0, 200) ?? null,
        whatsapp,
        email: email?.substring(0, 255) ?? null,
        meeting_pain: dificuldade ?? null,
        client_observations: observations || null,
        lead_source: "marketing",
        stage: "prospeccao",
        temperature: "morno",
        is_new: true,
        utm_source: pick(p, ["utm_source"]),
        utm_medium: pick(p, ["utm_medium"]),
        utm_campaign: pick(p, ["utm_campaign"]),
        utm_conjunto: pick(p, ["utm_content", "utm_conjunto", "adset"]),
        history: [
          {
            type: "sistema",
            note: `📥 Lead recebido automaticamente${formName ? ` via "${formName}"` : " via integração"}`,
            date: new Date().toISOString(),
            user: "Integração",
          },
        ],
      };

      if (existingId) {
        // Não sobrescreve dados existentes com nulos
        const clean = Object.fromEntries(
          Object.entries(payload).filter(([k, v]) => v != null && !["user_id", "history", "is_new", "stage", "temperature"].includes(k)),
        );
        const { error } = await supabase.from("leads").update(clean).eq("id", existingId);
        results.push({
          name: payload.name as string,
          status: error ? "erro" : "atualizado",
          lead_id: existingId,
          error: error?.message,
        });
        continue;
      }

      const { data: inserted, error } = await supabase
        .from("leads")
        .insert(payload)
        .select("id")
        .single();

      results.push({
        name: payload.name as string,
        status: error ? "erro" : "criado",
        lead_id: inserted?.id,
        error: error?.message,
      });
    }

    console.log("receive-lead:", JSON.stringify(results));
    return json({ success: true, processed: results.length, results });
  } catch (e) {
    console.error("receive-lead error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
