ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS medical_examiner_name text,
  ADD COLUMN IF NOT EXISTS mechanic_examiner_name text;

COMMENT ON COLUMN public.inspections.medical_examiner_name IS 'Медицинский работник, назначенный настройками на момент проведения осмотра';
COMMENT ON COLUMN public.inspections.mechanic_examiner_name IS 'Механик, назначенный настройками на момент проведения осмотра';
