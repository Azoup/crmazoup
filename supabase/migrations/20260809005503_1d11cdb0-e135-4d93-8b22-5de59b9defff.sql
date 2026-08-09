CREATE POLICY "Approved users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND public.is_user_approved(auth.uid()));