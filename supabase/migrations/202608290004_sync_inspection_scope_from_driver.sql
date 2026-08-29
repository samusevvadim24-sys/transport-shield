BEGIN;

-- Всегда фиксируем в осмотре тот набор этапов, который настроен у водителя.
-- Это важно, потому что значение по умолчанию у inspections = 'both',
-- а заявка могла быть создана без явной передачи inspection_scope.
CREATE OR REPLACE FUNCTION public.sync_inspection_scope_from_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scope text;
BEGIN
    SELECT COALESCE(NULLIF(d.inspection_scope, ''), 'both')
      INTO v_scope
    FROM public.drivers d
    WHERE d.id = NEW.driver_id;

    IF v_scope IS NOT NULL THEN
        NEW.inspection_scope := v_scope;
    ELSE
        NEW.inspection_scope := COALESCE(NULLIF(NEW.inspection_scope, ''), 'both');
    END IF;

    -- Неиспользуемый этап сразу помечаем как "Не требуется".
    IF NEW.inspection_scope = 'medical' THEN
        NEW.mechanic_status := 'Не требуется';
        NEW.mechanic_date := NULL;
        NEW.mechanic_issues := NULL;
        NEW.mechanic_examiner_id := NULL;
        NEW.mechanic_examiner_name := NULL;
    ELSIF NEW.inspection_scope = 'mechanic' THEN
        NEW.medical_status := 'Не требуется';
        NEW.medical_date := NULL;
        NEW.breathalyzer_value := NULL;
        NEW.blood_pressure_systolic := NULL;
        NEW.blood_pressure_diastolic := NULL;
        NEW.drug_intoxication := FALSE;
        NEW.medical_examiner_id := NULL;
        NEW.medical_examiner_name := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inspection_scope_from_driver
ON public.inspections;

CREATE TRIGGER trg_sync_inspection_scope_from_driver
BEFORE INSERT ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.sync_inspection_scope_from_driver();

-- Исправляем уже созданные ожидающие/не завершённые осмотры.
UPDATE public.inspections i
SET
    inspection_scope = COALESCE(NULLIF(d.inspection_scope, ''), 'both'),
    mechanic_status = CASE
        WHEN COALESCE(NULLIF(d.inspection_scope, ''), 'both') = 'medical'
            THEN 'Не требуется'
        ELSE i.mechanic_status
    END,
    medical_status = CASE
        WHEN COALESCE(NULLIF(d.inspection_scope, ''), 'both') = 'mechanic'
            THEN 'Не требуется'
        ELSE i.medical_status
    END
FROM public.drivers d
WHERE d.id = i.driver_id
  AND i.overall_status IN ('Ожидание', 'Явиться');

COMMIT;
