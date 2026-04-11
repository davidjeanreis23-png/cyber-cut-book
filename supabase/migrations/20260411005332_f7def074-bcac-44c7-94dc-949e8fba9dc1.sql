-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.appointment_status AS ENUM ('confirmed', 'cancelled', 'completed', 'pending_payment');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'refunded', 'waived');
CREATE TYPE public.theme_option AS ENUM ('purple-cyber', 'green-neon', 'blue-electric', 'orange-flame', 'pink-neon');

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table as required)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Barbers
CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  photo_url TEXT,
  specialties TEXT[],
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- Barber schedules
CREATE TABLE public.barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.barber_schedules ENABLE ROW LEVEL SECURITY;

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  status appointment_status NOT NULL DEFAULT 'confirmed',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_ref TEXT,
  notes TEXT,
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Unique constraint to prevent double booking
CREATE UNIQUE INDEX idx_appointments_no_double_booking
  ON public.appointments (barber_id, appointment_date, appointment_time)
  WHERE status IN ('confirmed', 'completed');

-- Loyalty points
CREATE TABLE public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- Loyalty transactions
CREATE TABLE public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Loyalty rewards
CREATE TABLE public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  points_needed INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- Settings (singleton)
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_time TEXT NOT NULL DEFAULT '08:00',
  closing_time TEXT NOT NULL DEFAULT '20:00',
  appointment_interval INTEGER NOT NULL DEFAULT 30,
  default_appointment_duration INTEGER NOT NULL DEFAULT 30,
  barber_address TEXT,
  current_theme theme_option NOT NULL DEFAULT 'purple-cyber',
  google_calendar_connected BOOLEAN NOT NULL DEFAULT false,
  google_calendar_id TEXT,
  whatsapp_connected BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT,
  payment_gateway TEXT,
  loyalty_points_per_booking INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ================================
-- RLS POLICIES
-- ================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Barbers (read: any auth, write: admin)
CREATE POLICY "Anyone can view barbers" ON public.barbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage barbers" ON public.barbers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Barber schedules
CREATE POLICY "Anyone can view schedules" ON public.barber_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage schedules" ON public.barber_schedules FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Services
CREATE POLICY "Anyone can view services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Appointments
CREATE POLICY "Users can view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users and admins can update appointments" ON public.appointments FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins can delete appointments" ON public.appointments FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Loyalty points
CREATE POLICY "Users can view own points" ON public.loyalty_points FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage points" ON public.loyalty_points FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Loyalty transactions
CREATE POLICY "Users can view own transactions" ON public.loyalty_transactions FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage transactions" ON public.loyalty_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Loyalty rewards
CREATE POLICY "Anyone can view rewards" ON public.loyalty_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage rewards" ON public.loyalty_rewards FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Settings
CREATE POLICY "Anyone can view settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ================================
-- TRIGGERS
-- ================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_barbers_updated_at BEFORE UPDATE ON public.barbers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loyalty_points_updated_at BEFORE UPDATE ON public.loyalty_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================
-- AUTO-CREATE PROFILE + ROLE ON SIGNUP
-- ================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.loyalty_points (user_id, points) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================
-- SEED DEFAULT SETTINGS
-- ================================
INSERT INTO public.settings (opening_time, closing_time, appointment_interval, default_appointment_duration, loyalty_points_per_booking) 
VALUES ('08:00', '20:00', 30, 30, 10);