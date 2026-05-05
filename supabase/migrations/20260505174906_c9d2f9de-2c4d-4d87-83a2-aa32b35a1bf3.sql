
-- 1. Fix is_manager to require approved = true
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = _user_id AND role = 'Gestor' AND approved = true
    )
  END
$$;

-- 2. Fix profiles INSERT policy: force role = 'SDR'
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id AND role = 'SDR');

-- 3. Fix profiles UPDATE policy: prevent users from changing approved or role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = get_user_role(auth.uid())
  AND approved = is_user_approved(auth.uid())
);

-- 4. Revoke EXECUTE from anon on security definer functions
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_managed_sdr_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_user_approved(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_lead_user_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_reference_month() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
