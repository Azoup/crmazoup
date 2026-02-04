import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize string input: trim, limit length, remove potentially dangerous characters
function sanitizeString(input: unknown, maxLength: number): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return String(input).substring(0, maxLength);
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>{}[\]\\]/g, ''); // Remove potentially dangerous characters
}

// Validate email format
function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

// Sanitize phone number
function sanitizePhone(phone: unknown): string | null {
  if (phone === null || phone === undefined) return null;
  if (typeof phone !== 'string') return null;
  // Keep only digits, plus, parentheses, spaces, and hyphens
  const sanitized = phone.replace(/[^0-9+() -]/g, '').substring(0, 50);
  return sanitized || null;
}

// Validate and sanitize contact data from ActiveCampaign
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
  
  // ID is required
  if (!rawContact.id) return null;
  
  const id = String(rawContact.id);
  const firstName = sanitizeString(rawContact.firstName, 100);
  const lastName = sanitizeString(rawContact.lastName, 100);
  const email = rawContact.email && isValidEmail(rawContact.email) 
    ? sanitizeString(rawContact.email, 255) 
    : null;
  const phone = sanitizePhone(rawContact.phone);
  const orgname = sanitizeString(rawContact.orgname, 200) || null;
  const tags = contactTags[id] || [];
  
  return { id, firstName, lastName, email, phone, orgname, tags };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    
    // Get ActiveCampaign credentials from secrets
    const acApiKey = Deno.env.get('ACTIVECAMPAIGN_API_KEY');
    const acUrl = Deno.env.get('ACTIVECAMPAIGN_URL');

    if (!acApiKey || !acUrl) {
      console.error('ActiveCampaign credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de integração não configurado' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ error: 'Erro ao sincronizar contatos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const acData = await acResponse.json();
    const contacts = acData.contacts || [];

    console.log(`Found ${contacts.length} contacts in ActiveCampaign`);

    // Fetch tags for all contacts
    const contactTags: Record<string, string[]> = {};
    for (const contact of contacts) {
      const contactId = String(contact.id);
      try {
        const tagsResponse = await fetch(`${acUrl}/api/3/contacts/${contactId}/contactTags`, {
          headers: {
            'Api-Token': acApiKey,
            'Content-Type': 'application/json',
          },
        });
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          const tagIds = (tagsData.contactTags || []).map((ct: any) => ct.tag);
          
          // Fetch tag names
          const tagNames: string[] = [];
          for (const tagId of tagIds) {
            const tagResponse = await fetch(`${acUrl}/api/3/tags/${tagId}`, {
              headers: {
                'Api-Token': acApiKey,
                'Content-Type': 'application/json',
              },
            });
            if (tagResponse.ok) {
              const tagData = await tagResponse.json();
              if (tagData.tag?.tag) {
                tagNames.push(sanitizeString(tagData.tag.tag, 100));
              }
            }
          }
          contactTags[contactId] = tagNames;
        }
      } catch (e) {
        console.error(`Error fetching tags for contact ${contactId}:`, e);
      }
    }

    console.log('Tags fetched for contacts');

    // Get existing leads to avoid duplicates
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('activecampaign_id')
      .eq('user_id', userId)
      .not('activecampaign_id', 'is', null);

    const existingAcIds = new Set((existingLeads || []).map(l => l.activecampaign_id));

    // Filter new contacts
    const newContacts = contacts.filter((c: unknown) => {
      if (!c || typeof c !== 'object') return false;
      const id = (c as Record<string, unknown>).id;
      return id && !existingAcIds.has(String(id));
    });

    console.log(`${newContacts.length} new contacts to import`);

    let imported = 0;
    const errorCount = { validation: 0, database: 0 };

    for (const contact of newContacts) {
      try {
        // Validate and sanitize contact data
        const validated = validateContact(contact, contactTags);
        if (!validated) {
          errorCount.validation++;
          continue;
        }
        
        const fullName = `${validated.firstName} ${validated.lastName}`.trim();
        const tagsNote = validated.tags.length > 0 
          ? ` | Tags: ${validated.tags.join(', ')}`
          : '';
        
        const leadData = {
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
          history: [{
            type: 'sistema',
            note: `Lead importado automaticamente do ActiveCampaign em ${new Date().toLocaleDateString('pt-BR')}${tagsNote}`,
            date: new Date().toISOString(),
            user: 'Sistema'
          }]
        };

        const { error: insertError } = await supabase
          .from('leads')
          .insert(leadData);

        if (insertError) {
          console.error('Error inserting lead:', insertError);
          errorCount.database++;
        } else {
          imported++;
        }
      } catch (e) {
        console.error('Error processing contact:', e);
        errorCount.database++;
      }
    }

    console.log(`Successfully imported ${imported} leads`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        total: contacts.length,
        skipped: contacts.length - newContacts.length,
        errors: errorCount.validation + errorCount.database > 0 
          ? `${errorCount.validation} validação, ${errorCount.database} banco de dados`
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
