-- Add new column for pieces produced per month
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pieces_per_month integer DEFAULT NULL;