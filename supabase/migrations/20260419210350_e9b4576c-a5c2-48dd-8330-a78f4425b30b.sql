-- Replace broad SELECT with one that allows direct file access but blocks listing.
-- storage.objects SELECT controls both reading and listing; with bucket public=true,
-- public URLs work without RLS. We restrict the policy to authenticated/admin for listing.
DROP POLICY IF EXISTS "Public can view barber photos" ON storage.objects;

CREATE POLICY "Admins list barber photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'barbers' AND public.has_role(auth.uid(), 'admin'));