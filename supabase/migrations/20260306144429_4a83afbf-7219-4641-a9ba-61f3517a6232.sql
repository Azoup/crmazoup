-- Expandir visibilidade e edição de leads do gestor para SDRs vinculados
-- Mantém regras atuais e adiciona acesso SDR -> leads criados pelo seu gestor

DROP POLICY IF EXISTS "Users can view leads" ON public.leads;
CREATE POLICY "Users can view leads"
ON public.leads
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (auth.uid() = responsible_user_id)
  OR (user_id IN (SELECT public.get_managed_sdr_ids(auth.uid())))
  OR EXISTS (
    SELECT 1
    FROM public.manager_sdr_relations msr
    WHERE msr.manager_id = public.leads.user_id
      AND msr.sdr_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update leads" ON public.leads;
CREATE POLICY "Users can update leads"
ON public.leads
FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR (auth.uid() = responsible_user_id)
  OR (user_id IN (SELECT public.get_managed_sdr_ids(auth.uid())))
  OR EXISTS (
    SELECT 1
    FROM public.manager_sdr_relations msr
    WHERE msr.manager_id = public.leads.user_id
      AND msr.sdr_id = auth.uid()
  )
);