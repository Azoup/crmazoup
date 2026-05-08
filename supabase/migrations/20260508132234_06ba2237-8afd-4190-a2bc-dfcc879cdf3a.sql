
GRANT EXECUTE ON FUNCTION public.is_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_managed_sdr_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_user_id(uuid) TO authenticated;
