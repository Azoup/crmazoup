ALTER TABLE public.products ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS installments_text text;