-- ---------- 1. LIMPEZA DE DADOS DE NEGÓCIO ----------
TRUNCATE TABLE
  public.commission_earnings,
  public.financial_transactions,
  public.service_commissions,
  public.loyalty_transactions,
  public.loyalty_points,
  public.loyalty_rewards,
  public.notifications,
  public.appointments,
  public.barber_schedules,
  public.barbers,
  public.services,
  public.settings
RESTART IDENTITY CASCADE;

-- ---------- 2. TABELA TENANTS ----------
CREATE TYPE public.tenant_status AS ENUM ('trial', 'active', 'blocked', 'cancelled');

CREATE TABLE public.tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  owner_name      text NOT NULL,
  email           text NOT NULL UNIQUE,
  phone           text,
  cpf_cnpj        text,
  address         text,
  city            text,
  state           text,
  status          public.tenant_status NOT NULL DEFAULT 'trial',
  plan            text NOT NULL DEFAULT 'pro',
  plan_price      numeric(10,2) NOT NULL DEFAULT 39.00,
  trial_start     timestamptz NOT NULL DEFAULT now(),
  trial_end       timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  subscription_id text,
  paid_until      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_email ON public.tenants(email);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters manage tenants"
  ON public.tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_tenant_trial_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.trial_start IS NULL THEN NEW.trial_start := now(); END IF;
  IF NEW.trial_end   IS NULL THEN NEW.trial_end   := NEW.trial_start + interval '5 days'; END IF;
  IF NEW.status      IS NULL THEN NEW.status      := 'trial'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_trial_defaults
  BEFORE INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_trial_defaults();

-- ---------- 3. TENANT_ID NAS TABELAS DE NEGÓCIO ----------
ALTER TABLE public.profiles     ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.barbers      ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.services     ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.settings     ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX idx_profiles_tenant     ON public.profiles(tenant_id);
CREATE INDEX idx_barbers_tenant      ON public.barbers(tenant_id);
CREATE INDEX idx_services_tenant     ON public.services(tenant_id);
CREATE INDEX idx_appointments_tenant ON public.appointments(tenant_id);
CREATE INDEX idx_settings_tenant     ON public.settings(tenant_id);

-- ---------- 4. FUNÇÃO AUXILIAR ----------
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- ---------- 5. RLS MULTI-TENANT ----------

-- BARBERS
DROP POLICY IF EXISTS "Admins can manage barbers" ON public.barbers;
DROP POLICY IF EXISTS "Anyone can view barbers" ON public.barbers;

CREATE POLICY "View barbers (tenant or master)" ON public.barbers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant admins manage own barbers" ON public.barbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Master manages all barbers" ON public.barbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- SERVICES
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;

CREATE POLICY "View services (tenant or master)" ON public.services FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant admins manage own services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Master manages all services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- APPOINTMENTS
DROP POLICY IF EXISTS "Admins can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users and admins can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can view own appointments" ON public.appointments;

CREATE POLICY "View appointments scoped" ON public.appointments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'master')
    OR (auth.uid() = user_id AND tenant_id = public.get_user_tenant_id(auth.uid()))
    OR (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  );
CREATE POLICY "Create own appointments in tenant" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Update appointments scoped" ON public.appointments FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'master')
    OR (auth.uid() = user_id AND tenant_id = public.get_user_tenant_id(auth.uid()))
    OR (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  );
CREATE POLICY "Delete appointments scoped" ON public.appointments FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'master')
    OR (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  );

-- SETTINGS
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Anyone can view settings" ON public.settings;

CREATE POLICY "View settings (tenant or master)" ON public.settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant admins manage own settings" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Master manages all settings" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- PROFILES (master vê todos)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "View profiles (self/admin/master)" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- ---------- 6. CRIAR PAPEL MASTER ----------
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'davidjeanreis.29@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'master')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;