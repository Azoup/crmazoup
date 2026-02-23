import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation
interface LeadInput {
  name?: string;
  company?: string;
  confection_type?: string;
  stage?: string;
  meeting_pain?: string;
}

function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength).replace(/[<>{}[\]\\]/g, '');
}

function validateLead(lead: unknown): LeadInput {
  if (!lead || typeof lead !== 'object') return {};
  const rawLead = lead as Record<string, unknown>;
  return {
    name: sanitizeString(rawLead.name, 200),
    company: sanitizeString(rawLead.company, 200),
    confection_type: sanitizeString(rawLead.confection_type, 100),
    stage: sanitizeString(rawLead.stage, 50),
    meeting_pain: sanitizeString(rawLead.meeting_pain, 500),
  };
}

function validateType(type: unknown): 'whatsapp' | 'strategy' | 'objection' | null {
  if (type === 'whatsapp' || type === 'strategy' || type === 'objection') return type;
  return null;
}

function sanitizeObjection(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength).replace(/[<>{}[\]\\]/g, '');
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

    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.warn('Invalid JWT token:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    console.log(`Authenticated user: ${userId}`);
    // === END AUTHENTICATION CHECK ===

    const body = await req.json();
    
    const type = validateType(body.type);
    if (!type) {
      return new Response(JSON.stringify({ error: "Tipo de mensagem inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
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
Sempre seja educado e direto. Máximo de 3 frases.
REGRA OBRIGATÓRIA: A mensagem DEVE começar com o nome do lead. Sempre use o nome exato fornecido.
Retorne APENAS o texto da mensagem, sem aspas, sem explicações adicionais.`;
      
      const leadName = lead.name || 'Cliente';
      userPrompt = `Gere uma mensagem de WhatsApp de primeiro contato para:
- Nome do lead: ${leadName}
- Empresa: ${lead.company || 'Não informada'}
- Tipo de confecção: ${lead.confection_type || 'Não informado'}
- Fase atual: ${lead.stage || 'prospecção'}

A mensagem DEVE obrigatoriamente começar com "Olá ${leadName}" ou "Oi ${leadName}".
Objetivo: Avançar o lead no funil de vendas de forma natural e consultiva.`;
    } else if (type === "strategy") {
      systemPrompt = `Você é um estrategista de vendas SaaS especializado em soluções para confecções têxteis.
Forneça insights práticos e acionáveis em formato de bullet points.`;
      
      userPrompt = `Crie uma estratégia para reunião com:
- Cliente: ${lead.name || 'Cliente'}
- Tipo: ${lead.confection_type || 'Não informado'}
- Dores identificadas: ${lead.meeting_pain || 'Não informadas'}

Gere 3-5 pontos-chave para abordar na reunião.`;
    } else if (type === "objection") {
      const objection = sanitizeObjection(body.objection, 1000);
      if (!objection) {
        return new Response(JSON.stringify({ error: "Descreva a objeção do cliente." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      systemPrompt = `Você é um especialista em vendas B2B para confecções têxteis, trabalhando para a Azoup (sistema ERP/gestão para confecções).
Você é mestre em contornar objeções de forma empática, profissional e persuasiva.
Suas respostas devem ser mensagens prontas para enviar via WhatsApp — curtas, diretas e humanizadas.
Retorne EXATAMENTE 3 opções de resposta, cada uma numerada (1., 2., 3.), separadas por duas quebras de linha.
Cada resposta deve ter no máximo 4 frases. Não adicione explicações extras, apenas as 3 mensagens.`;

      userPrompt = `O lead "${lead.name || 'Cliente'}" da empresa "${lead.company || 'Não informada'}" (confecção: ${lead.confection_type || 'Não informado'}) está na fase de PROPOSTA e apresentou a seguinte objeção/desafio:

"${objection}"

Gere 3 respostas persuasivas diferentes para contornar essa objeção via WhatsApp. Cada resposta deve começar com o nome do lead.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`AI gateway error: ${response.status} - ${errorBody}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar mensagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let message = data.choices?.[0]?.message?.content || "";
    
    // Clean up AI response - remove quotes, markdown artifacts
    message = message
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .trim();

    if (!message) {
      return new Response(JSON.stringify({ error: "A IA não retornou uma mensagem válida." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
