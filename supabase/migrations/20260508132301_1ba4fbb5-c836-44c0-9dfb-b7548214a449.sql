
-- LEADS: require approval for all access
DROP POLICY IF EXISTS "Users can view leads" ON public.leads;
CREATE POLICY "Users can view leads"
ON public.leads FOR SELECT
USING (
  public.is_user_approved(auth.uid()) AND (
    auth.uid() = user_id
    OR auth.uid() = responsible_user_id
    OR user_id IN (SELECT public.get_managed_sdr_ids(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.manager_sdr_relations msr
      WHERE msr.manager_id = leads.user_id AND msr.sdr_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
CREATE POLICY "Users can insert their own leads"
ON public.leads FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Users can update leads" ON public.leads;
CREATE POLICY "Users can update leads"
ON public.leads FOR UPDATE
USING (
  public.is_user_approved(auth.uid()) AND (
    auth.uid() = user_id
    OR auth.uid() = responsible_user_id
    OR user_id IN (SELECT public.get_managed_sdr_ids(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.manager_sdr_relations msr
      WHERE msr.manager_id = leads.user_id AND msr.sdr_id = auth.uid()
    )
  )
)
WITH CHECK (user_id = public.get_lead_user_id(id));

DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
CREATE POLICY "Users can delete their own leads"
ON public.leads FOR DELETE
USING (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

-- PROPOSALS
DROP POLICY IF EXISTS "Users can view their own proposals" ON public.proposals;
CREATE POLICY "Users can view their own proposals"
ON public.proposals FOR SELECT
USING (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Users can create their own proposals" ON public.proposals;
CREATE POLICY "Users can create their own proposals"
ON public.proposals FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own proposals" ON public.proposals;
CREATE POLICY "Users can update their own proposals"
ON public.proposals FOR UPDATE
USING (auth.uid() = user_id AND public.is_user_approved(auth.uid()))
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own proposals" ON public.proposals;
CREATE POLICY "Users can delete their own proposals"
ON public.proposals FOR DELETE
USING (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

-- MANUAL QUOTES
DROP POLICY IF EXISTS "Users can view their own manual quotes" ON public.manual_quotes;
CREATE POLICY "Users can view their own manual quotes"
ON public.manual_quotes FOR SELECT TO authenticated
USING (public.is_user_approved(auth.uid()) AND (auth.uid() = user_id OR public.is_manager(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own manual quotes" ON public.manual_quotes;
CREATE POLICY "Users can create their own manual quotes"
ON public.manual_quotes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own manual quotes" ON public.manual_quotes;
CREATE POLICY "Users can update their own manual quotes"
ON public.manual_quotes FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.is_user_approved(auth.uid()))
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own manual quotes" ON public.manual_quotes;
CREATE POLICY "Users can delete their own manual quotes"
ON public.manual_quotes FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

-- PRODUCTS
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products"
ON public.products FOR SELECT TO authenticated
USING (public.is_user_approved(auth.uid()));

-- PROFILES: only approved users may see other users' profiles; everyone can see own
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    public.is_user_approved(auth.uid()) AND (
      public.is_manager(auth.uid())
      OR user_id IN (SELECT public.get_managed_sdr_ids(auth.uid()))
    )
  )
);
