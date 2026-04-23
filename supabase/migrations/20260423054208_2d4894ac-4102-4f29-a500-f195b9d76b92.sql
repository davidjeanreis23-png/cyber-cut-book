
-- 1) SETTINGS: restringir SELECT para esconder tokens Google de usuários comuns
DROP POLICY IF EXISTS "View settings (tenant or master)" ON public.settings;

-- Apenas admin do tenant ou master podem ler a tabela settings completa (com tokens)
CREATE POLICY "Admins and master can view full settings"
ON public.settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
);

-- View pública (sem tokens) para que clientes do tenant possam ler config básica
CREATE OR REPLACE VIEW public.settings_public
WITH (security_invoker = true)
AS
SELECT
  id,
  tenant_id,
  opening_time,
  closing_time,
  appointment_interval,
  default_appointment_duration,
  loyalty_points_per_booking,
  current_theme,
  barber_address,
  whatsapp_number,
  whatsapp_connected,
  google_calendar_connected,
  payment_gateway,
  created_at,
  updated_at
FROM public.settings;

-- A view herda RLS via security_invoker; criamos política de leitura ampla para tenant
CREATE POLICY "Tenant members read public settings"
ON public.settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR tenant_id = get_user_tenant_id(auth.uid())
);

-- Hmm, a view security_invoker re-aplica RLS de settings, o que tornaria o esconder tokens inútil.
-- Solução melhor: revogar a política ampla acima e usar SECURITY DEFINER function/grant na view.
-- Ajuste: removemos a política ampla recém-criada e expomos a view com grants específicos.
DROP POLICY IF EXISTS "Tenant members read public settings" ON public.settings;

ALTER VIEW public.settings_public SET (security_invoker = false);
GRANT SELECT ON public.settings_public TO authenticated, anon;

-- 2) TENANTS: permitir que admin leia o próprio tenant
CREATE POLICY "Admins can view own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND id = get_user_tenant_id(auth.uid())
);

-- 3) NOTIFICATION_SETTINGS: restringir leitura a admin/master
DROP POLICY IF EXISTS "Anyone authenticated can read notification settings" ON public.notification_settings;

CREATE POLICY "Admins and master can read notification settings"
ON public.notification_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role)
);

-- 4) USER_ROLES: impedir admin de criar role 'master'
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage non-master roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND role <> 'master'::app_role
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND role <> 'master'::app_role
);

CREATE POLICY "Master can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));
