-- The application uses public.users + localStorage for authentication rather than
-- Supabase Auth. Therefore the browser uses the anon database role.

GRANT SELECT, INSERT, UPDATE
ON public.system_settings
TO anon;

DROP POLICY IF EXISTS "Custom auth can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Custom auth can insert system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Custom auth can update system settings" ON public.system_settings;

CREATE POLICY "Custom auth can read system settings"
ON public.system_settings
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Custom auth can insert system settings"
ON public.system_settings
FOR INSERT
TO anon
WITH CHECK (id = 1);

CREATE POLICY "Custom auth can update system settings"
ON public.system_settings
FOR UPDATE
TO anon
USING (id = 1)
WITH CHECK (id = 1);
