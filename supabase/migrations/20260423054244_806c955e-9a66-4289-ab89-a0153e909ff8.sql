
CREATE OR REPLACE FUNCTION public.get_public_settings(_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  opening_time text,
  closing_time text,
  appointment_interval integer,
  default_appointment_duration integer,
  loyalty_points_per_booking integer,
  current_theme theme_option,
  barber_address text,
  whatsapp_number text,
  whatsapp_connected boolean,
  google_calendar_connected boolean,
  payment_gateway text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.tenant_id, s.opening_time, s.closing_time,
    s.appointment_interval, s.default_appointment_duration,
    s.loyalty_points_per_booking, s.current_theme, s.barber_address,
    s.whatsapp_number, s.whatsapp_connected, s.google_calendar_connected,
    s.payment_gateway, s.created_at, s.updated_at
  FROM public.settings s
  WHERE s.tenant_id = _tenant_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR s.tenant_id = get_user_tenant_id(auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_public_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings(uuid) TO authenticated;
