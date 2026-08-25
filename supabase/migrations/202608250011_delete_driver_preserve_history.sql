-- Delete drivers through a SECURITY DEFINER RPC so admin RLS does not block deletion.
-- Financial history is preserved independently from the drivers row.

ALTER TABLE public.customer_balance_transactions
    ADD COLUMN IF NOT EXISTS driver_id bigint,
    ADD COLUMN IF NOT EXISTS driver_name text,
    ADD COLUMN IF NOT EXISTS driver_car_brand text,
    ADD COLUMN IF NOT EXISTS driver_car_number text;

-- Backfill driver snapshots before any driver can be removed.
UPDATE public.customer_balance_transactions t
SET
    driver_name = COALESCE(t.driver_name, d.name),
    driver_car_brand = COALESCE(t.driver_car_brand, d.car_brand),
    driver_car_number = COALESCE(t.driver_car_number, d.car_number),
    driver_id = COALESCE(t.driver_id, d.id)
FROM public.drivers d
WHERE t.driver_id = d.id
  AND (
      t.driver_name IS NULL
      OR t.driver_car_brand IS NULL
      OR t.driver_car_number IS NULL
      OR t.driver_id IS NULL
  );

-- A financial record must never depend on the lifetime of a driver.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.customer_balance_transactions'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%driver_id%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.customer_balance_transactions DROP CONSTRAINT %I',
            r.conname
        );
    END LOOP;
END $$;

-- Keep inspections after driver deletion, but detach them from the deleted driver.
ALTER TABLE public.inspections
    ALTER COLUMN driver_id DROP NOT NULL;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.inspections'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%driver_id%'
          AND pg_get_constraintdef(oid) ILIKE '%drivers%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.inspections DROP CONSTRAINT %I',
            r.conname
        );
    END LOOP;
END $$;

ALTER TABLE public.inspections
    ADD CONSTRAINT inspections_driver_id_fkey
    FOREIGN KEY (driver_id)
    REFERENCES public.drivers(id)
    ON DELETE SET NULL;

-- Delete a driver atomically and preserve his identity in balance history.
CREATE OR REPLACE FUNCTION public.delete_driver_record(
    p_admin_id bigint,
    p_driver_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id bigint;
    v_name text;
    v_car_brand text;
    v_car_number text;
BEGIN
    -- Only administrators may execute the destructive operation.
    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_admin_id
          AND u.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Недостаточно прав для удаления водителя';
    END IF;

    SELECT
        d.user_id,
        d.name,
        d.car_brand,
        d.car_number
    INTO
        v_user_id,
        v_name,
        v_car_brand,
        v_car_number
    FROM public.drivers d
    WHERE d.id = p_driver_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Водитель % не найден', p_driver_id;
    END IF;

    -- Freeze the driver's identity in every financial transaction before deletion.
    UPDATE public.customer_balance_transactions t
    SET
        driver_name = COALESCE(t.driver_name, v_name),
        driver_car_brand = COALESCE(t.driver_car_brand, v_car_brand),
        driver_car_number = COALESCE(t.driver_car_number, v_car_number)
    WHERE t.driver_id = p_driver_id;

    -- inspections.driver_id is ON DELETE SET NULL, so inspection history survives.
    DELETE FROM public.drivers
    WHERE id = p_driver_id;

    -- Remove the login belonging to the deleted driver as well.
    IF v_user_id IS NOT NULL THEN
        DELETE FROM public.users
        WHERE id = v_user_id;
    END IF;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_driver_record(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_driver_record(bigint, bigint) TO authenticated;
