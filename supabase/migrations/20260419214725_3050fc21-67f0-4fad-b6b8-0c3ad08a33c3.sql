-- Allow public read access to barber photos so the public bucket works end-to-end
DROP POLICY IF EXISTS "Admins list barber photos" ON storage.objects;

CREATE POLICY "Public can view barber photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'barbers');