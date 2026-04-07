
-- Add approved column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Auto-approve existing users
UPDATE public.profiles SET approved = true;

-- Auto-approve the admin user by email
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'leonardo.azoup@gmail.com';
  IF admin_uid IS NOT NULL THEN
    UPDATE public.profiles SET approved = true WHERE user_id = admin_uid;
  END IF;
END;
$$;

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT approved FROM public.profiles WHERE user_id = _user_id LIMIT 1),
    false
  );
$$;
