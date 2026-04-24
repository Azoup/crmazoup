ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS signer_phone text,
ADD COLUMN IF NOT EXISTS signer_email text,
ADD COLUMN IF NOT EXISTS implementation_responsible_phone text;