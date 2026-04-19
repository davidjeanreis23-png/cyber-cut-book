-- Tighten notifications INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Note: triggers run as SECURITY DEFINER (postgres role) and bypass RLS, so they can still insert.