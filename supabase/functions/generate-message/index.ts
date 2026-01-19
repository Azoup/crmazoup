import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, lead } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-message error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});