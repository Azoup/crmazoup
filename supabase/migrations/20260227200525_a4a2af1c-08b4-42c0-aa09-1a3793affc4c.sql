
-- Add lead_source to differentiate lead origins
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT 'marketing';

-- Add meeting_goal to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS meeting_goal integer DEFAULT 0;
