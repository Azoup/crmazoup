ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_live_launch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_launch_contacted boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';