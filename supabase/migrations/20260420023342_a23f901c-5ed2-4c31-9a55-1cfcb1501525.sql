-- Function: handle loyalty points on appointment status change
CREATE OR REPLACE FUNCTION public.handle_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_existing INTEGER;
BEGIN
  -- COMPLETED: award points (only once per appointment)
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT COALESCE(loyalty_points_per_booking, 10) INTO v_points
    FROM public.settings
    WHERE tenant_id = NEW.tenant_id
    LIMIT 1;

    IF v_points IS NULL THEN v_points := 10; END IF;

    -- Skip if already awarded for this appointment
    IF NOT EXISTS (
      SELECT 1 FROM public.loyalty_transactions
      WHERE appointment_id = NEW.id AND points > 0
    ) THEN
      INSERT INTO public.loyalty_points (user_id, points, cuts_count, reward_available)
      VALUES (NEW.user_id, 0, 0, false)
      ON CONFLICT (user_id) DO NOTHING;

      UPDATE public.loyalty_points
      SET points = points + v_points,
          updated_at = now()
      WHERE user_id = NEW.user_id;

      INSERT INTO public.loyalty_transactions (user_id, points, description, appointment_id)
      VALUES (NEW.user_id, v_points, 'Agendamento concluído', NEW.id);
    END IF;

  -- CANCELLED: refund points if previously awarded
  ELSIF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    SELECT COALESCE(SUM(points), 0) INTO v_existing
    FROM public.loyalty_transactions
    WHERE appointment_id = NEW.id;

    IF v_existing > 0 THEN
      UPDATE public.loyalty_points
      SET points = GREATEST(points - v_existing, 0),
          updated_at = now()
      WHERE user_id = NEW.user_id;

      INSERT INTO public.loyalty_transactions (user_id, points, description, appointment_id)
      VALUES (NEW.user_id, -v_existing, 'Estorno por cancelamento', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_loyalty_points ON public.appointments;
CREATE TRIGGER trg_appointments_loyalty_points
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_loyalty_points();

-- Add push_token column to profiles for Web Push (item 3 prep)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;