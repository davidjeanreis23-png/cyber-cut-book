
-- 1) Storage: bucket "barbers" — restringir LIST, manter SELECT por URL pública
-- Remove qualquer policy ampla pré-existente nesse bucket
DROP POLICY IF EXISTS "Public read barbers bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read barbers" ON storage.objects;
DROP POLICY IF EXISTS "Public Access barbers" ON storage.objects;
DROP POLICY IF EXISTS "barbers_public_select" ON storage.objects;

-- Leitura individual (GET por chave conhecida) permanece pública
CREATE POLICY "barbers_read_objects"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'barbers');

-- Upload/Update/Delete: somente admins/master
DROP POLICY IF EXISTS "barbers_admin_insert" ON storage.objects;
CREATE POLICY "barbers_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barbers'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
);

DROP POLICY IF EXISTS "barbers_admin_update" ON storage.objects;
CREATE POLICY "barbers_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barbers'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
);

DROP POLICY IF EXISTS "barbers_admin_delete" ON storage.objects;
CREATE POLICY "barbers_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'barbers'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
);

-- 2) commission_earnings: permitir barbeiro ler as próprias comissões
-- (mantém política existente de admins)
CREATE POLICY "Barbers view own earnings"
ON public.commission_earnings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.id = commission_earnings.barber_id
  )
  OR has_role(auth.uid(), 'master'::app_role)
);
