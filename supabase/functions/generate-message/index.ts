import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
interface LeadInput {
  name?: string;
  company?: string;
  confection_type?: string;
  stage?: string;
  meeting_pain?: string;
}

// Sanitize string input: trim, limit length, remove potential injection characters
function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>{}[\]\\]/g, ''); // Remove potentially dangerous characters
}

// Validate and sanitize lead input
function validateLead(lead: unknown): LeadInput {
  if (!lead || typeof lead !== 'object') {
    return {};
  }
  
  const rawLead = lead as Record<string, unknown>;
  
  return {
    name: sanitizeString(rawLead.name, 200),
    company: sanitizeString(rawLead.company, 200),
    confection_type: sanitizeString(rawLead.confection_type, 100),
    stage: sanitizeString(rawLead.stage, 50),
    meeting_pain: sanitizeString(rawLead.meeting_pain, 500),
  };
}

// Validate type parameter
function validateType(type: unknown): 'whatsapp' | 'strategy' | null {
  if (type === 'whatsapp' || type === 'strategy') {
    return type;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTHENTICATION CHECK ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Serviço temporariamente indisponível' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.warn('Invalid JWT token:', claimsError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user: ${userId}`);
    // === END AUTHENTICATION CHECK ===

    const body = await req.json();
    
    // Validate type parameter
    const type = validateType(body.type);
    if (!type) {
      return new Response(JSON.stringify({ error: "Tipo de mensagem inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate and sanitize lead data
    const lead = validateLead(body.lead);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "whatsapp") {
      systemPrompt = `Você é um especialista em vendas B2B para confecções têxteis, trabalhando para a Azoup. 
Escreva mensagens de WhatsApp curtas, profissionais e persuasivas.
Sempre seja educado e direto. Máximo de 3 frases.`;
      
      userPrompt = `Gere uma mensagem de WhatsApp para:
- Nome: ${lead.name || 'Cliente'}
- Empresa: ${lead.company || 'Não informada'}
- Tipo de confecção: ${lead.confection_type || 'Não informado'}
- Fase atual: ${lead.stage || 'prospecção'}

Objetivo: Avançar o lead no funil de vendas de forma natural e consultiva.`;
    } else if (type === "strategy") {
      systemPrompt = `Você é um estrategista de vendas SaaS especializado em soluções para confecções têxteis.
Forneça insights práticos e acionáveis em formato de bullet points.`;
      
      userPrompt = `Crie uma estratégia para reunião com:
- Cliente: ${lead.name || 'Cliente'}
- Tipo: ${lead.confection_type || 'Não informado'}
- Dores identificadas: ${lead.meeting_pain || 'Não informadas'}

Gere 3-5 pontos-chave para abordar na reunião.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`AI gateway error: ${response.status}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar mensagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-message error:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar solicitação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
