
-- Drop the partial index that doesn't work with upsert
DROP INDEX IF EXISTS idx_leads_activecampaign_user;

-- Create a proper unique constraint (not partial) for upsert to work
ALTER TABLE public.leads ADD CONSTRAINT leads_activecampaign_user_unique UNIQUE (activecampaign_id, user_id);
