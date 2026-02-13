
-- Create proposals table to store generated proposals
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_name TEXT,
  plans JSONB NOT NULL DEFAULT '[]',
  payment_terms TEXT,
  discount TEXT,
  responsible_name TEXT,
  responsible_role TEXT,
  additional_notes TEXT,
  total_implementation NUMERIC DEFAULT 0,
  total_monthly NUMERIC DEFAULT 0,
  sent_via_whatsapp BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own proposals"
ON public.proposals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proposals"
ON public.proposals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proposals"
ON public.proposals FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_proposals_lead_id ON public.proposals(lead_id);
CREATE INDEX idx_proposals_user_id ON public.proposals(user_id);
