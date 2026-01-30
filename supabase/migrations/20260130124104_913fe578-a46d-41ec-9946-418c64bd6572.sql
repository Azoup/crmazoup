-- Drop the old check constraint and create a new one with 'proposta' included
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_stage_check 
CHECK (stage = ANY (ARRAY['prospeccao'::text, 'interesse'::text, 'reuniao'::text, 'proposta'::text, 'venda'::text, 'congelados'::text, 'perdidos'::text]));