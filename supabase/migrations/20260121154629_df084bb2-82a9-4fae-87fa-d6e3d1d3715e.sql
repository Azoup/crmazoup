-- Add new fields for meeting status and reference month
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meeting_status text DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reference_month text DEFAULT NULL;

-- Add a trigger to automatically set reference_month based on entry_date
-- The reference month follows the rule: day 26 to day 26 of next month
CREATE OR REPLACE FUNCTION public.calculate_reference_month()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry DATE;
  ref_month DATE;
BEGIN
  entry := COALESCE(NEW.entry_date, CURRENT_DATE);
  
  -- If day >= 26, reference month is next month
  -- If day < 26, reference month is current month
  IF EXTRACT(DAY FROM entry) >= 26 THEN
    ref_month := DATE_TRUNC('month', entry) + INTERVAL '1 month';
  ELSE
    ref_month := DATE_TRUNC('month', entry);
  END IF;
  
  NEW.reference_month := TO_CHAR(ref_month, 'YYYY-MM');
  RETURN NEW;
END;
$$;

-- Create trigger to auto-set reference_month on insert/update
DROP TRIGGER IF EXISTS set_reference_month ON public.leads;
CREATE TRIGGER set_reference_month
BEFORE INSERT OR UPDATE OF entry_date ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.calculate_reference_month();

-- Update existing leads to have reference_month calculated
UPDATE public.leads 
SET reference_month = CASE 
  WHEN EXTRACT(DAY FROM COALESCE(entry_date, created_at::date)) >= 26 
  THEN TO_CHAR(DATE_TRUNC('month', COALESCE(entry_date, created_at::date)) + INTERVAL '1 month', 'YYYY-MM')
  ELSE TO_CHAR(DATE_TRUNC('month', COALESCE(entry_date, created_at::date)), 'YYYY-MM')
END
WHERE reference_month IS NULL;