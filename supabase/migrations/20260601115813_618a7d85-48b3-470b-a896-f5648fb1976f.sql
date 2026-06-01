ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS new_system_link_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS new_system_link_sent_at timestamptz;