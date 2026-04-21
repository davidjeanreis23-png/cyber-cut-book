-- 1) Ensure a default tenant exists
DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, owner_name, email, status, plan, plan_price, trial_start, trial_end)
    VALUES ('AutoBarber', 'David', 'davidjeanreis.29@gmail.com', 'active', 'pro', 0, now(), now() + interval '365 days')
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Backfill tenant_id where missing
  UPDATE public.barbers   SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.services  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.settings  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.profiles  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;

  -- Ensure a settings row exists for the tenant
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE tenant_id = v_tenant_id) THEN
    INSERT INTO public.settings (tenant_id, opening_time, closing_time, appointment_interval)
    VALUES (v_tenant_id, '09:00', '19:00', 30);
  END IF;
END $$;

-- 2) Trigger that auto-fills tenant_id on appointment insert from the barber
CREATE OR REPLACE FUNCTION public.set_appointment_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.barbers WHERE id = NEW.barber_id;
  END IF;
  -- If user profile has no tenant yet, sync to the appointment's tenant
  IF NEW.tenant_id IS NOT NULL THEN
    UPDATE public.profiles SET tenant_id = NEW.tenant_id WHERE id = NEW.user_id AND tenant_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_appointment_tenant_id ON public.appointments;
CREATE TRIGGER trg_set_appointment_tenant_id
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_appointment_tenant_id();