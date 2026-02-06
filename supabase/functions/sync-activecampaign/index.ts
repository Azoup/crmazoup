import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function sanitizeString(input: unknown, maxLength: number): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return String(input).substring(0, maxLength);
  return input.trim().substring(0, maxLength).replace(/[<>{}[\]\\]/g, '');
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

interface ValidatedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  orgname: string | null;
  tags: string[];
}

function validateContact(contact: unknown, contactTags: Record<string, string[]>): ValidatedContact | null {
  if (!contact || typeof contact !== 'object') return null;
  const rawContact = contact as Record<string, unknown>;
  if (!rawContact.id) return null;
  
  const id = String(rawContact.id);
  return {
    id,
    firstName: sanitizeString(rawContact.firstName, 100),
    lastName: sanitizeString(rawContact.lastName, 100),
    email: rawContact.email && isValidEmail(rawContact.email) ? sanitizeString(rawContact.email, 255) : null,
    phone: sanitizePhone(rawContact.phone),
    orgname: sanitizeString(rawContact.orgname, 200) || null,
    tags: contactTags[id] || [],
  };
}

// Fetch all contacts with pagination
async function fetchAllContacts(acUrl: string, acApiKey: string): Promise<any[]> {
  const allContacts: any[] = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    console.log(`Fetching contacts offset=${offset}...`);
    const response = await fetch(`${acUrl}/api/3/contacts?limit=${limit}&offset=${offset}&orders[cdate]=DESC`, {
      headers: { 'Api-Token': acApiKey, 'Content-Type': 'application/json' },
    });
    
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

// Fetch tags for multiple contacts in batches
async function fetchContactTags(contacts: any[], acUrl: string, acApiKey: string): Promise<Record<string, string[]>> {
  const contactTags: Record<string, string[]> = {};
  const tagNameCache: Record<string, string> = {};
  
  // Process in batches of 10 to avoid too many concurrent requests
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
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
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;
    
    const acApiKey = Deno.env.get('ACTIVECAMPAIGN_API_KEY');
    const acUrl = Deno.env.get('ACTIVECAMPAIGN_URL');

    if (!acApiKey || !acUrl) {
      console.error('ActiveCampaign credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de integração não configurado' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching all contacts from ActiveCampaign...');
    const contacts = await fetchAllContacts(acUrl, acApiKey);
    console.log(`Found ${contacts.length} total contacts`);

    console.log('Fetching tags...');
    const contactTags = await fetchContactTags(contacts, acUrl, acApiKey);
    console.log('Tags fetched');

    // Get existing leads to avoid duplicates
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('activecampaign_id')
      .eq('user_id', userId)
      .not('activecampaign_id', 'is', null);

    const existingAcIds = new Set((existingLeads || []).map((l: any) => l.activecampaign_id));

    const newContacts = contacts.filter((c: unknown) => {
      if (!c || typeof c !== 'object') return false;
      const id = (c as Record<string, unknown>).id;
      return id && !existingAcIds.has(String(id));
    });

    console.log(`${newContacts.length} new contacts to import`);

    // Batch insert for better performance
    const leadsToInsert: any[] = [];
    let validationErrors = 0;

    for (const contact of newContacts) {
      const validated = validateContact(contact, contactTags);
      if (!validated) {
        validationErrors++;
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
        value: 0,
        responsible_user_id: userId,
        history: [{
          type: 'sistema',
          note: `Lead importado do ActiveCampaign em ${new Date().toLocaleDateString('pt-BR')}${tagsNote}`,
          date: new Date().toISOString(),
          user: 'Sistema'
        }]
      });
    }

    let imported = 0;
    let dbErrors = 0;

    // Insert in batches of 50
    for (let i = 0; i < leadsToInsert.length; i += 50) {
      const batch = leadsToInsert.slice(i, i + 50);
      const { error: insertError, data: insertedData } = await supabase
        .from('leads')
        .insert(batch);

      if (insertError) {
        console.error('Batch insert error:', insertError);
        dbErrors += batch.length;
      } else {
        imported += batch.length;
      }
    }

    console.log(`Successfully imported ${imported} leads`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        total: contacts.length,
        skipped: contacts.length - newContacts.length,
        errors: (validationErrors + dbErrors > 0) 
          ? `${validationErrors} validação, ${dbErrors} banco de dados`
          : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-activecampaign:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar sincronização' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
