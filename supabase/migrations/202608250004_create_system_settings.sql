-- System settings used by the administrator settings screen.
-- One row is used for the whole organization.

CREATE TABLE IF NOT EXISTS public.system_settings (
    id bigint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    medic_last_name text NOT NULL DEFAULT '',
    mechanic_last_name text NOT NULL DEFAULT '',
    medical_inspection_price numeric(12, 2) NOT NULL DEFAULT 0.90 CHECK (medical_inspection_price >= 0),
    mechanic_inspection_price numeric(12, 2) NOT NULL DEFAULT 0.90 CHECK (mechanic_inspection_price >= 0),
    organization_name text NOT NULL DEFAULT '',
    organization_address text NOT NULL DEFAULT '',
    organization_bank_account text NOT NULL DEFAULT '',
    organization_unp text NOT NULL DEFAULT '',
    organization_phone text NOT NULL DEFAULT '',
    organization_email text NOT NULL DEFAULT '',
    director_name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;

CREATE POLICY "Admins can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update system settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_system_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;

CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_system_settings_updated_at();

GRANT SELECT, UPDATE ON public.system_settings TO authenticated;
