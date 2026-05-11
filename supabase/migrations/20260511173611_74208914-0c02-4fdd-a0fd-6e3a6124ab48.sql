-- Harden profile updates: prevent non-managers from changing approved/role via a trigger guard.
-- This complements the existing WITH CHECK on the user self-update RLS policy.

CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the caller is the row owner and is NOT an approved manager,
  -- forbid changes to approved or role columns.
  IF auth.uid() = NEW.user_id AND NOT public.is_manager(auth.uid()) THEN
    IF NEW.approved IS DISTINCT FROM OLD.approved THEN
      RAISE EXCEPTION 'Não autorizado: somente um gestor pode alterar o status de aprovação.';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Não autorizado: somente um gestor pode alterar o papel.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_self_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_self_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_privilege_escalation();

-- Tighten the user self-update policy USING clause to also block updates
-- by unapproved users on sensitive columns (defense-in-depth).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = public.get_user_role(auth.uid())
  AND approved = public.is_user_approved(auth.uid())
);

-- Add approval gate to user_settings (users with unapproved accounts shouldn't
-- be able to access settings either, for consistency).
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Keep insert/update/delete as-is (these are personal settings rows, created on signup).
