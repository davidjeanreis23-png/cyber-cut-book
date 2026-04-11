
ALTER TABLE public.settings
ADD COLUMN google_access_token text,
ADD COLUMN google_refresh_token text,
ADD COLUMN google_token_expires_at timestamptz;
