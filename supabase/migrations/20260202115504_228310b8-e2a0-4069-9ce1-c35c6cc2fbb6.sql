-- Atualizar a função calculate_reference_month para usar calendário normal (01 a 30/31)
CREATE OR REPLACE FUNCTION public.calculate_reference_month()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  entry DATE;
BEGIN
  entry := COALESCE(NEW.entry_date, CURRENT_DATE);
  
  -- Use the calendar month directly (01 to 30/31)
  NEW.reference_month := TO_CHAR(entry, 'YYYY-MM');
  RETURN NEW;
END;
$function$;