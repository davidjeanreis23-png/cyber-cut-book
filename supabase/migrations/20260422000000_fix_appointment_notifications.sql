-- Fix: Only send appointment notification after payment is confirmed
-- For cash payments, send immediately. For other methods, wait for payment_status = 'paid'

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

  -- INSERT: only notify for cash payments or already paid appointments
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_method = 'cash' OR NEW.payment_status = 'paid' THEN
      INSERT INTO public.notifications (user_id, title, message, type, appointment_id)
      VALUES (
        NEW.user_id,
        'Agendamento confirmado',
        'Seu ' || COALESCE(v_service_name, 'serviço') || ' com ' || COALESCE(v_barber_name, 'barbeiro') ||
          ' foi marcado para ' || to_char(NEW.appointment_date, 'DD/MM/YYYY') || ' às ' || NEW.appointment_time || '.',
        'success',
        NEW.id
      );
    END IF;

  -- UPDATE: notify on cancellation (existing logic)
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.notifications (user_id, title, message, type, appointment_id)
    VALUES (
      NEW.user_id,
      'Agendamento cancelado',
      'Seu agendamento de ' || to_char(NEW.appointment_date, 'DD/MM/YYYY') || ' às ' || NEW.appointment_time || ' foi cancelado.',
      'warning',
      NEW.id
    );

  -- UPDATE: notify when payment is confirmed (new logic)
  ELSIF TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    INSERT INTO public.notifications (user_id, title, message, type, appointment_id)
    VALUES (
      NEW.user_id,
      'Agendamento confirmado',
      'Seu ' || COALESCE(v_service_name, 'serviço') || ' com ' || COALESCE(v_barber_name, 'barbeiro') ||
        ' foi marcado para ' || to_char(NEW.appointment_date, 'DD/MM/YYYY') || ' às ' || NEW.appointment_time || '.',
      'success',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate triggers to ensure they use the updated function
DROP TRIGGER IF EXISTS trg_appointment_notify_insert ON public.appointments;
CREATE TRIGGER trg_appointment_notify_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_notifications();

DROP TRIGGER IF EXISTS trg_appointment_notify_update ON public.appointments;
CREATE TRIGGER trg_appointment_notify_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXecute FUNCTION public.handle_appointment_notifications();