ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS medical_examiner_id bigint,
  ADD COLUMN IF NOT EXISTS mechanic_examiner_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inspections_medical_examiner_id_fkey'
  ) THEN
    ALTER TABLE public.inspections
      ADD CONSTRAINT inspections_medical_examiner_id_fkey
      FOREIGN KEY (medical_examiner_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inspections_mechanic_examiner_id_fkey'
  ) THEN
    ALTER TABLE public.inspections
      ADD CONSTRAINT inspections_mechanic_examiner_id_fkey
      FOREIGN KEY (mechanic_examiner_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.inspections.medical_examiner_id IS 'Пользователь, фактически проведший медицинский осмотр';
COMMENT ON COLUMN public.inspections.mechanic_examiner_id IS 'Пользователь, фактически проведший механический осмотр';
