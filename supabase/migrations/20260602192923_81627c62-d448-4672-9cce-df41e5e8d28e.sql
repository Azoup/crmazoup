ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_contact_type text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_conjunto text;

NOTIFY pgrst, 'reload schema';