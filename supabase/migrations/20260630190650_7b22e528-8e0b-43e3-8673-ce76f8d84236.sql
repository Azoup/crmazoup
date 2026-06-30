
-- Revoke EXECUTE on SECURITY DEFINER helper functions from anon (and PUBLIC); keep authenticated where needed
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_lead_user_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_managed_sdr_ids(uuid) FROM PUBLIC, anon;

-- These are internal helpers used by RLS policies; authenticated role needs EXECUTE
GRANT EXECUTE ON FUNCTION public.is_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_managed_sdr_ids(uuid) TO authenticated;

-- Trigger functions: not callable via API, revoke broadly
REVOKE EXECUTE ON FUNCTION public.calculate_reference_month() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_privilege_escalation() FROM PUBLIC, anon, authenticated;

-- Tighten manager_sdr_relations SDR SELECT policy to require approval
DROP POLICY IF EXISTS "SDRs can view their own relations" ON public.manager_sdr_relations;
CREATE POLICY "SDRs can view their own relations"
ON public.manager_sdr_relations
FOR SELECT
TO authenticated
USING (sdr_id = auth.uid() AND public.is_user_approved(auth.uid()));
