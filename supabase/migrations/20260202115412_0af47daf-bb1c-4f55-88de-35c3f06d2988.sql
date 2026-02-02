-- Alterar o default de temperatura de 'morno' para 'frio' para novos leads
ALTER TABLE public.leads ALTER COLUMN temperature SET DEFAULT 'frio';

-- Adicionar política para gestores poderem excluir leads de seus SDRs
DROP POLICY IF EXISTS "Managers can delete managed leads" ON public.leads;
CREATE POLICY "Managers can delete managed leads" 
ON public.leads 
FOR DELETE 
USING (user_id IN (SELECT get_managed_sdr_ids(auth.uid())));