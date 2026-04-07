
-- Function to get lead owner without triggering RLS
CREATE OR REPLACE FUNCTION public.get_lead_user_id(_lead_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.leads WHERE id = _lead_id LIMIT 1;
$$;

-- Drop the broken UPDATE policy
DROP POLICY IF EXISTS "Users can update leads" ON public.leads;

-- Recreate UPDATE policy without self-referencing subquery
CREATE POLICY "Users can update leads"
ON public.leads
FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR (auth.uid() = responsible_user_id)
  OR (user_id IN (SELECT get_managed_sdr_ids(auth.uid())))
  OR (EXISTS (
    SELECT 1 FROM manager_sdr_relations msr
    WHERE msr.manager_id = leads.user_id AND msr.sdr_id = auth.uid()
  ))
)
WITH CHECK (
  user_id = public.get_lead_user_id(id)
);
