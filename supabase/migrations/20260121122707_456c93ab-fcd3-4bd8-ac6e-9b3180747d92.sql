-- Add field to mark new leads (from ActiveCampaign)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_new boolean DEFAULT true;

-- Add field for manager notes (post-meeting follow-up)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS manager_notes text;

-- Add field to track which ActiveCampaign contact ID this lead came from
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS activecampaign_id text;

-- Create table to link managers to SDRs they supervise
CREATE TABLE IF NOT EXISTS public.manager_sdr_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  sdr_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(manager_id, sdr_id)
);

-- Enable RLS on manager_sdr_relations
ALTER TABLE public.manager_sdr_relations ENABLE ROW LEVEL SECURITY;

-- Managers can view their own relations
CREATE POLICY "Managers can view their relations"
ON public.manager_sdr_relations FOR SELECT
USING (
  manager_id IN (
    SELECT user_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'Gestor'
  )
);

-- Managers can insert their own relations
CREATE POLICY "Managers can insert relations"
ON public.manager_sdr_relations FOR INSERT
WITH CHECK (
  manager_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'Gestor')
);

-- Managers can delete their own relations
CREATE POLICY "Managers can delete relations"
ON public.manager_sdr_relations FOR DELETE
USING (
  manager_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'Gestor')
);

-- Update leads RLS to allow managers to view their SDRs' leads
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
CREATE POLICY "Users can view leads"
ON public.leads FOR SELECT
USING (
  auth.uid() = user_id OR
  user_id IN (
    SELECT sdr_id FROM public.manager_sdr_relations WHERE manager_id = auth.uid()
  )
);

-- Managers can update SDR leads (for manager_notes)
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
CREATE POLICY "Users can update leads"
ON public.leads FOR UPDATE
USING (
  auth.uid() = user_id OR
  user_id IN (
    SELECT sdr_id FROM public.manager_sdr_relations WHERE manager_id = auth.uid()
  )
);

-- Allow managers to view SDR profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = user_id OR
  user_id IN (
    SELECT sdr_id FROM public.manager_sdr_relations WHERE manager_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'Gestor')
);