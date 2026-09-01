-- The application uses custom HttpOnly-cookie authentication, not Supabase Auth.
-- Public reads are required by existing client-side dashboard queries.
-- Writes are handled by authenticated Next.js server routes.

GRANT SELECT ON public.inspection_points TO anon;

DROP POLICY IF EXISTS "Custom auth can read inspection points" ON public.inspection_points;
CREATE POLICY "Custom auth can read inspection points"
ON public.inspection_points
FOR SELECT
TO anon
USING (true);
