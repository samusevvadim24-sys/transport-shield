-- Defines which inspection components a driver must pass.
-- Existing drivers continue to require both components.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS inspection_scope text NOT NULL DEFAULT 'both';

ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_inspection_scope_check;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_inspection_scope_check
  CHECK (inspection_scope IN ('medical', 'mechanic', 'both'));

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS inspection_scope text NOT NULL DEFAULT 'both';

ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_inspection_scope_check;

ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_inspection_scope_check
  CHECK (inspection_scope IN ('medical', 'mechanic', 'both'));

-- New inspection inherits the driver's configured scope.
CREATE OR REPLACE FUNCTION public.set_inspection_scope_from_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text;
BEGIN
  SELECT COALESCE(inspection_scope, 'both')
    INTO v_scope
  FROM public.drivers
  WHERE id = NEW.driver_id;

  NEW.inspection_scope := COALESCE(v_scope, 'both');

  IF NEW.inspection_scope = 'medical' THEN
    NEW.mechanic_status := 'Не требуется';
  ELSIF NEW.inspection_scope = 'mechanic' THEN
    NEW.medical_status := 'Не требуется';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_inspection_scope_from_driver ON public.inspections;
CREATE TRIGGER trg_set_inspection_scope_from_driver
BEFORE INSERT ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.set_inspection_scope_from_driver();

-- Keep the unused component out of the inspection result and its audit fields.
CREATE OR REPLACE FUNCTION public.normalize_inspection_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.inspection_scope = 'medical' THEN
    NEW.mechanic_status := 'Не требуется';
    NEW.mechanic_date := NULL;
    NEW.mechanic_issues := NULL;
    NEW.mechanic_examiner_id := NULL;
    NEW.mechanic_examiner_name := NULL;
    NEW.overall_status := CASE
      WHEN NEW.medical_status IN ('Допущен', 'Не допущен') THEN NEW.medical_status
      ELSE NEW.overall_status
    END;
  ELSIF NEW.inspection_scope = 'mechanic' THEN
    NEW.medical_status := 'Не требуется';
    NEW.medical_date := NULL;
    NEW.breathalyzer_value := NULL;
    NEW.blood_pressure_systolic := NULL;
    NEW.blood_pressure_diastolic := NULL;
    NEW.drug_intoxication := false;
    NEW.medical_examiner_id := NULL;
    NEW.medical_examiner_name := NULL;
    NEW.overall_status := CASE
      WHEN NEW.mechanic_status IN ('Допущен', 'Не допущен') THEN NEW.mechanic_status
      ELSE NEW.overall_status
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_inspection_scope ON public.inspections;
CREATE TRIGGER trg_normalize_inspection_scope
BEFORE UPDATE OF inspection_scope, medical_status, mechanic_status, medical_date, mechanic_date ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.normalize_inspection_scope();

-- Re-run normalization for existing records without changing their current scope.
UPDATE public.inspections
SET inspection_scope = COALESCE(inspection_scope, 'both')
WHERE inspection_scope IS NULL;
