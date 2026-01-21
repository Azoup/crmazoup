-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view their relations" ON public.manager_sdr_relations;
DROP POLICY IF EXISTS "Managers can insert relations" ON public.manager_sdr_relations;
DROP POLICY IF EXISTS "Managers can delete relations" ON public.manager_sdr_relations;
DROP POLICY IF EXISTS "Users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads" ON public.leads;

-- Create security definer function to check if user is a manager (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'Gestor'
  )
$$;

-- Create security definer function to get SDR IDs for a manager (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_managed_sdr_ids(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sdr_id FROM public.manager_sdr_relations
  WHERE manager_id = _manager_id
$$;

-- Recreate profiles SELECT policy without recursion
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.is_manager(auth.uid())
  OR user_id IN (SELECT public.get_managed_sdr_ids(auth.uid()))
);

-- Recreate manager_sdr_relations policies without recursion
CREATE POLICY "Managers can view their relations"
ON public.manager_sdr_relations
FOR SELECT
USING (manager_id = auth.uid() AND public.is_manager(auth.uid()));

CREATE POLICY "Managers can insert relations"
ON public.manager_sdr_relations
FOR INSERT
WITH CHECK (manager_id = auth.uid() AND public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete relations"
ON public.manager_sdr_relations
FOR DELETE
USING (manager_id = auth.uid() AND public.is_manager(auth.uid()));

-- Recreate leads policies without recursion
CREATE POLICY "Users can view leads"
ON public.leads
FOR SELECT
USING (
  auth.uid() = user_id 
  OR user_id IN (SELECT public.get_managed_sdr_ids(auth.uid()))
);

CREATE POLICY "Users can update leads"
ON public.leads
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR user_id IN (SELECT public.get_managed_sdr_ids(auth.uid()))
);