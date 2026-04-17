-- Financial transactions table (entries and exits)
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  payment_method TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage financial transactions"
ON public.financial_transactions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_type ON public.financial_transactions(type);
CREATE INDEX idx_financial_transactions_barber ON public.financial_transactions(barber_id);

-- Service commission splits per barber (percentage)
CREATE TABLE public.service_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, barber_id)
);

ALTER TABLE public.service_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commissions"
ON public.service_commissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view commissions"
ON public.service_commissions FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER set_service_commissions_updated_at
BEFORE UPDATE ON public.service_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Commission earnings table (calculated when an appointment is completed)
CREATE TABLE public.commission_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  percentage NUMERIC(5,2) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage earnings"
ON public.commission_earnings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_commission_earnings_date ON public.commission_earnings(earned_date);
CREATE INDEX idx_commission_earnings_barber ON public.commission_earnings(barber_id);

-- Function to auto-create financial entry + commissions when appointment is completed
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_price NUMERIC;
  v_service_name TEXT;
  v_commission RECORD;
BEGIN
  -- Only when transitioning to completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT price, name INTO v_service_price, v_service_name
    FROM public.services WHERE id = NEW.service_id;

    -- Skip if already registered
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions WHERE appointment_id = NEW.id AND type = 'income'
    ) THEN
      INSERT INTO public.financial_transactions
        (type, amount, category, description, payment_method, transaction_date, appointment_id, service_id, barber_id)
      VALUES
        ('income', v_service_price, 'Serviço', v_service_name, NEW.payment_method, NEW.appointment_date, NEW.id, NEW.service_id, NEW.barber_id);
    END IF;

    -- Create commission earnings (skip if already created)
    IF NOT EXISTS (
      SELECT 1 FROM public.commission_earnings WHERE appointment_id = NEW.id
    ) THEN
      FOR v_commission IN
        SELECT barber_id, percentage FROM public.service_commissions WHERE service_id = NEW.service_id
      LOOP
        INSERT INTO public.commission_earnings
          (appointment_id, barber_id, service_id, percentage, amount, earned_date)
        VALUES
          (NEW.id, v_commission.barber_id, NEW.service_id, v_commission.percentage,
           ROUND(v_service_price * v_commission.percentage / 100, 2), NEW.appointment_date);
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_completed
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_completion();