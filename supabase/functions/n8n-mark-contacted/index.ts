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

    const body = await req.json();
    const { lead_id, message_sent } = body;

    if (!lead_id || typeof lead_id !== "string") {
      return new Response(JSON.stringify({ error: "lead_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current lead to update history
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("history, name")
      .eq("id", lead_id)
      .single();

    if (fetchError || !lead) {
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentHistory = Array.isArray(lead.history) ? lead.history : [];
    const newHistoryEntry = {
      type: "whatsapp",
      note: `🤖 [n8n Auto] Primeiro contato enviado via WhatsApp: "${(message_sent || "").substring(0, 150)}..."`,
      date: new Date().toISOString(),
      user: "n8n Bot",
    };

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        is_new: false,
        last_contact: new Date().toISOString(),
        history: [...currentHistory, newHistoryEntry],
      })
      .eq("id", lead_id);

    if (updateError) {
      console.error("Error updating lead:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar lead" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Lead ${lead_id} (${lead.name}) marked as contacted by n8n`);

    return new Response(JSON.stringify({ success: true, lead_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("n8n-mark-contacted error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
