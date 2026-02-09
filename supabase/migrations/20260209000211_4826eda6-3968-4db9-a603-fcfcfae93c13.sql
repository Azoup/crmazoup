-- Create unique constraint for ActiveCampaign deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_activecampaign_user 
ON public.leads (activecampaign_id, user_id) 
WHERE activecampaign_id IS NOT NULL;