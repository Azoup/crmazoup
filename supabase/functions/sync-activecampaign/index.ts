import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;
    
    // Get ActiveCampaign credentials from secrets
    const acApiKey = Deno.env.get('ACTIVECAMPAIGN_API_KEY');
    const acUrl = Deno.env.get('ACTIVECAMPAIGN_URL');

    if (!acApiKey || !acUrl) {
      console.error('ActiveCampaign credentials not configured');
      return new Response(
        JSON.stringify({ error: 'ActiveCampaign não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching contacts from ActiveCampaign...');

    // Fetch contacts from ActiveCampaign
    const acResponse = await fetch(`${acUrl}/api/3/contacts?limit=100&orders[cdate]=DESC`, {
      headers: {
        'Api-Token': acApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!acResponse.ok) {
      const errorText = await acResponse.text();
      console.error('ActiveCampaign API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar contatos do ActiveCampaign', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const acData = await acResponse.json();
    const contacts = acData.contacts || [];

    console.log(`Found ${contacts.length} contacts in ActiveCampaign`);

    // Get existing leads to avoid duplicates
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('activecampaign_id')
      .eq('user_id', userId)
      .not('activecampaign_id', 'is', null);

    const existingAcIds = new Set((existingLeads || []).map(l => l.activecampaign_id));

    // Filter new contacts
    const newContacts = contacts.filter((c: any) => !existingAcIds.has(c.id.toString()));

    console.log(`${newContacts.length} new contacts to import`);

    let imported = 0;
    const errors: string[] = [];

    for (const contact of newContacts) {
      try {
        const leadData = {
          user_id: userId,
          name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Sem nome',
          email: contact.email || null,
          whatsapp: contact.phone || null,
          company: contact.orgname || null,
          stage: 'prospeccao',
          temperature: 'morno',
          is_new: true,
          activecampaign_id: contact.id.toString(),
          value: 0,
          history: [{
            type: 'sistema',
            note: `Lead importado automaticamente do ActiveCampaign em ${new Date().toLocaleDateString('pt-BR')}`,
            date: new Date().toISOString(),
            user: 'Sistema'
          }]
        };

        const { error: insertError } = await supabase
          .from('leads')
          .insert(leadData);

        if (insertError) {
          console.error('Error inserting lead:', insertError);
          errors.push(`Erro ao importar ${contact.email}: ${insertError.message}`);
        } else {
          imported++;
        }
      } catch (e) {
        console.error('Error processing contact:', e);
        errors.push(`Erro ao processar contato: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
      }
    }

    console.log(`Successfully imported ${imported} leads`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        total: contacts.length,
        skipped: contacts.length - newContacts.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-activecampaign:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
