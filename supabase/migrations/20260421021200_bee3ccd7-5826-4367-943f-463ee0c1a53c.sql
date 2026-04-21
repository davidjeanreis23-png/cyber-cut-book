
-- 1) notification_settings table (single row, admin controls)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  push_confirmed BOOLEAN NOT NULL DEFAULT true,
  push_cancelled BOOLEAN NOT NULL DEFAULT true,
  push_reminder_24h BOOLEAN NOT NULL DEFAULT true,
  push_payment BOOLEAN NOT NULL DEFAULT true,
  push_loyalty_points BOOLEAN NOT NULL DEFAULT true,
  push_reward_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read notification settings"
  ON public.notification_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update notification settings"
  ON public.notification_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert notification settings"
  ON public.notification_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- 2) Ensure pg_net is available for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3) Reattach all missing triggers on appointments
DROP TRIGGER IF EXISTS trg_appointments_set_tenant ON public.appointments;
CREATE TRIGGER trg_appointments_set_tenant
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_appointment_tenant_id();

DROP TRIGGER IF EXISTS trg_appointments_notifications ON public.appointments;
CREATE TRIGGER trg_appointments_notifications
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_notifications();

DROP TRIGGER IF EXISTS trg_appointments_loyalty_points ON public.appointments;
CREATE TRIGGER trg_appointments_loyalty_points
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.handle_loyalty_points();

DROP TRIGGER IF EXISTS trg_appointments_loyalty_cuts ON public.appointments;
CREATE TRIGGER trg_appointments_loyalty_cuts
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.handle_loyalty_cuts();

DROP TRIGGER IF EXISTS trg_appointments_financial ON public.appointments;
CREATE TRIGGER trg_appointments_financial
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_completion();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- profiles.handle_new_user already attached on auth.users? recreate to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- tenant trial defaults
DROP TRIGGER IF EXISTS trg_tenants_trial_defaults ON public.tenants;
CREATE TRIGGER trg_tenants_trial_defaults
BEFORE INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_trial_defaults();

-- 4) Loyalty points & rewards => generate notifications + push
CREATE OR REPLACE FUNCTION public.handle_loyalty_points_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Only on positive earnings
  IF NEW.points > 0 THEN
    SELECT points INTO v_total FROM public.loyalty_points WHERE user_id = NEW.user_id;
    INSERT INTO public.notifications (user_id, title, message, type, appointment_id)
    VALUES (
      NEW.user_id,
      '⭐ Você ganhou pontos!',
      'Parabéns! Você ganhou ' || NEW.points || ' pontos de fidelidade. Total: ' || COALESCE(v_total, NEW.points) || ' pontos.',
      'success',
      NEW.appointment_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_points_notify ON public.loyalty_transactions;
CREATE TRIGGER trg_loyalty_points_notify
AFTER INSERT ON public.loyalty_transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_loyalty_points_notifications();

-- 5) Dispatcher: every new notification fires send-push (respecting toggles)
CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_allowed BOOLEAN := true;
  v_url TEXT := '/appointments';
  v_title TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  SELECT * INTO v_settings FROM public.notification_settings LIMIT 1;

  -- Map notification title -> toggle + url
  v_title := NEW.title;
  IF v_title ILIKE '%confirmado%' AND v_title NOT ILIKE '%pagamento%' THEN
    v_allowed := COALESCE(v_settings.push_confirmed, true);
  ELSIF v_title ILIKE '%cancelado%' THEN
    v_allowed := COALESCE(v_settings.push_cancelled, true);
  ELSIF v_title ILIKE '%amanhã%' OR v_title ILIKE '%lembrete%' THEN
    v_allowed := COALESCE(v_settings.push_reminder_24h, true);
  ELSIF v_title ILIKE '%pagamento%' THEN
    v_allowed := COALESCE(v_settings.push_payment, true);
  ELSIF v_title ILIKE '%pontos%' THEN
    v_allowed := COALESCE(v_settings.push_loyalty_points, true);
    v_url := '/loyalty';
  ELSIF v_title ILIKE '%recompensa%' OR v_title ILIKE '%corte grátis%' THEN
    v_allowed := COALESCE(v_settings.push_reward_available, true);
    v_url := '/loyalty';
  END IF;

  IF NOT v_allowed THEN RETURN NEW; END IF;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_key := current_setting('app.service_role_key', true);

  -- Fire & forget; if pg_net not configured, ignore errors
  BEGIN
    PERFORM net.http_post(
      url := COALESCE(v_supabase_url, 'https://tegbsetxdvgqojmlfwig.supabase.co') || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'message', NEW.message,
        'url', v_url
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silent: never break the insert
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_dispatch_push ON public.notifications;
CREATE TRIGGER trg_notifications_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_for_notification();
