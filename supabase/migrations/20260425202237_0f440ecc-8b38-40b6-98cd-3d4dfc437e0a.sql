ALTER TABLE public.tenants ALTER COLUMN plan_price SET DEFAULT 29.99;
UPDATE public.tenants SET plan_price = 29.99 WHERE plan_price = 39.00 OR plan_price = 0.00;