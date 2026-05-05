-- Remove duplicate trigger that was causing double notifications
-- The new triggers (trg_appointment_notify_insert/update) already handle this

DROP TRIGGER IF EXISTS trg_appointments_notifications ON public.appointments;