-- Allow SDRs to see their own manager-SDR relation (so they can find their manager)
CREATE POLICY "SDRs can view their own relations"
ON public.manager_sdr_relations
FOR SELECT
USING (sdr_id = auth.uid());