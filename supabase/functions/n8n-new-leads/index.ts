import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate via N8N_API_KEY
    const authHeader = req.headers.get("Authorization");
    const n8nApiKey = Deno.env.get("N8N_API_KEY");

    if (!n8nApiKey) {
      console.error("N8N_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Serviço não configurado" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authHeader || authHeader !== `Bearer ${n8nApiKey}`) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch new leads in prospecção stage
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, name, company, confection_type, whatsapp, email, stage, temperature, entry_date, user_id, is_new")
      .eq("stage", "prospeccao")
      .eq("is_new", true)
      .not("whatsapp", "is", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching leads:", error);
      return new Response(JSON.stringify({ error: "Erro ao buscar leads" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${leads?.length || 0} new leads in prospecção`);

    return new Response(JSON.stringify({ leads: leads || [], count: leads?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("n8n-new-leads error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
