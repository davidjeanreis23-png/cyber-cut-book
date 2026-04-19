-- 1) Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  appointment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage notifications"
  ON public.notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- 2) Add cuts counter to loyalty_points (keep existing points system)
ALTER TABLE public.loyalty_points
  ADD COLUMN IF NOT EXISTS cuts_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_available BOOLEAN NOT NULL DEFAULT false;

-- 3) Trigger: notify on appointment insert / status change
CREATE OR REPLACE FUNCTION public.handle_appointment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_name TEXT;
  v_barber_name TEXT;
BEGIN
  SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
  SELECT name INTO v_barber_name FROM public.barbers WHERE id = NEW.barber_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type, appointment_id)
    VALUES (
      NEW.user_id,
      'Agendamento confirmado',
      'Seu ' || COALESCE(v_service_name, 'serviço') || ' com ' || COALESCE(v_barber_name, 'barbeiro') ||
        ' foi marcado para ' || to_char(NEW.appointment_date, 'DD/MM/YYYY') || ' às ' || NEW.appointment_time || '.',
      'success',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.notifications (user_id, title, message, type, appointment_id)
    VALUES (
      NEW.user_id,
      'Agendamento cancelado',
      'Seu agendamento de ' || to_char(NEW.appointment_date, 'DD/MM/YYYY') || ' às ' || NEW.appointment_time || ' foi cancelado.',
      'warning',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointment_notify_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_notifications();

CREATE TRIGGER trg_appointment_notify_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_notifications();

-- 4) Trigger: increment cuts on completion (10 cuts = 1 free)
CREATE OR REPLACE FUNCTION public.handle_loyalty_cuts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Ensure row exists
    INSERT INTO public.loyalty_points (user_id, points, cuts_count, reward_available)
    VALUES (NEW.user_id, 0, 0, false)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.loyalty_points
    SET cuts_count = cuts_count + 1,
        updated_at = now()
    WHERE user_id = NEW.user_id
    RETURNING cuts_count INTO v_new_count;

    IF v_new_count >= 10 THEN
      UPDATE public.loyalty_points
      SET cuts_count = 0,
          reward_available = true,
          updated_at = now()
      WHERE user_id = NEW.user_id;

      INSERT INTO public.notifications (user_id, title, message, type, appointment_id)
      VALUES (
        NEW.user_id,
        '🎉 Corte grátis desbloqueado!',
        'Você completou 10 cortes e ganhou 1 corte grátis. Aproveite!',
        'success',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Need unique constraint on user_id for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_points_user_id_key'
  ) THEN
    ALTER TABLE public.loyalty_points ADD CONSTRAINT loyalty_points_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE TRIGGER trg_loyalty_cuts
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_loyalty_cuts();

-- 5) Storage bucket for barber photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('barbers', 'barbers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view barber photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'barbers');

CREATE POLICY "Admins upload barber photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'barbers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update barber photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'barbers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete barber photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'barbers' AND public.has_role(auth.uid(), 'admin'));