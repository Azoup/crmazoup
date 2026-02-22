-- Change next_contact from date to timestamp with time zone to support time-based scheduling
ALTER TABLE public.leads 
ALTER COLUMN next_contact TYPE timestamp with time zone 
USING next_contact::timestamp with time zone;