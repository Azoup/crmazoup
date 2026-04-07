
-- Allow managers to update the 'approved' field on profiles
CREATE POLICY "Managers can update approval status"
ON public.profiles
FOR UPDATE
USING (is_manager(auth.uid()))
WITH CHECK (
  is_manager(auth.uid())
  AND role = get_user_role(profiles.user_id)
);
