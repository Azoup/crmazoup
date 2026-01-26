-- Add implementation_value and monthly_value columns to leads table
ALTER TABLE public.leads 
ADD COLUMN implementation_value numeric DEFAULT 0,
ADD COLUMN monthly_value numeric DEFAULT 0;

-- Migrate existing value data to implementation_value (assuming existing values were implementation)
UPDATE public.leads SET implementation_value = COALESCE(value, 0) WHERE value > 0;