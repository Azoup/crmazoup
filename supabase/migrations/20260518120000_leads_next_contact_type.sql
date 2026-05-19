-- Tipo do próximo contato agendado (ligação ou mensagem)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_contact_type text;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_next_contact_type_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_next_contact_type_check
  CHECK (next_contact_type IS NULL OR next_contact_type IN ('ligacao', 'mensagem'));
