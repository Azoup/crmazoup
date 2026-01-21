-- Add DELETE policy for profiles table so users can delete their own profile
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add NULL check to is_manager function for better security
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
      WHERE user_id = _user_id AND role = 'Gestor'
    )
  END
$$;

-- Add NULL check to get_managed_sdr_ids function for better security
CREATE OR REPLACE FUNCTION public.get_managed_sdr_ids(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _manager_id IS NULL THEN NULL::uuid
    ELSE sdr_id
  END
  FROM public.manager_sdr_relations
  WHERE _manager_id IS NOT NULL AND manager_id = _manager_id
$$;