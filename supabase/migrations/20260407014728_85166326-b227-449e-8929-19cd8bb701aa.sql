
-- Fix 1: Prevent role self-escalation on profiles
-- Drop existing UPDATE policy and recreate with WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Fix 2: Prevent ownership reassignment on leads
-- Drop existing UPDATE policy and recreate with WITH CHECK preventing user_id changes
DROP POLICY IF EXISTS "Users can update leads" ON public.leads;

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
  user_id = (SELECT l.user_id FROM public.leads l WHERE l.id = leads.id)
);
