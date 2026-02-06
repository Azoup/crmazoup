
-- Add responsible_user_id column to leads table
ALTER TABLE public.leads ADD COLUMN responsible_user_id uuid;

-- Default responsible to the lead owner (user_id)
UPDATE public.leads SET responsible_user_id = user_id WHERE responsible_user_id IS NULL;

-- Update RLS policy for leads to allow viewing/updating leads where user is responsible
DROP POLICY IF EXISTS "Users can view leads" ON public.leads;
CREATE POLICY "Users can view leads" ON public.leads
FOR SELECT USING (
  (auth.uid() = user_id) 
  OR (auth.uid() = responsible_user_id)
  OR (user_id IN (SELECT get_managed_sdr_ids(auth.uid()) AS get_managed_sdr_ids))
);

DROP POLICY IF EXISTS "Users can update leads" ON public.leads;
CREATE POLICY "Users can update leads" ON public.leads
FOR UPDATE USING (
  (auth.uid() = user_id) 
  OR (auth.uid() = responsible_user_id)
  OR (user_id IN (SELECT get_managed_sdr_ids(auth.uid()) AS get_managed_sdr_ids))
);

-- Fix February meeting data: update leads with January or NULL meeting_dates
-- Everton Domingues Ramos
UPDATE public.leads SET meeting_date = '2026-02-04 14:00:00+00' 
WHERE id = 'e80124df-dfad-4bfe-83fc-cf427698e1ee';

-- Sebastião Teixeira Fernandes
UPDATE public.leads SET meeting_date = '2026-02-04 10:00:00+00' 
WHERE id = 'b8dfeca4-8910-4d20-8176-3525def41d22';

-- Vinicius
UPDATE public.leads SET meeting_date = '2026-02-04 18:00:00+00' 
WHERE id = '0e9589b0-9887-4096-b27f-3afe1f7b5df2';

-- Noeli
UPDATE public.leads SET meeting_date = '2026-02-03 14:00:00+00' 
WHERE id = 'f7c72e6a-eabc-4239-b669-24ed68cfc55f';

-- Julio Souza
UPDATE public.leads SET meeting_date = '2026-02-03 16:00:00+00' 
WHERE id = '9a201787-fe12-4843-80c3-c0a79d25bab2';
