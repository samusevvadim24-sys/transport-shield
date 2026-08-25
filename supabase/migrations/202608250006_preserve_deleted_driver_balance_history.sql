-- Preserve the identity of a driver in financial history even after the driver is deleted.
-- Driver deletion must not delete or block customer balance transactions.

ALTER TABLE public.customer_balance_transactions
ADD COLUMN IF NOT EXISTS driver_name text,
ADD COLUMN IF NOT EXISTS driver_car_brand text,
ADD COLUMN IF NOT EXISTS driver_car_number text;

-- Backfill snapshots for existing transactions while the driver row still exists.
UPDATE public.customer_balance_transactions t
SET
    driver_name = COALESCE(t.driver_name, d.name),
    driver_car_brand = COALESCE(t.driver_car_brand, d.car_brand),
    driver_car_number = COALESCE(t.driver_car_number, d.car_number)
FROM public.drivers d
WHERE t.driver_id = d.id
  AND (
      t.driver_name IS NULL
      OR t.driver_car_brand IS NULL
      OR t.driver_car_number IS NULL
  );

-- Do not allow an FK from the financial history to drivers.
-- The transaction is an immutable financial record, not a live driver relation.
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

-- Driver deletion is currently blocked by inspections.driver_id being NOT NULL
-- and by its FK to drivers. Keep historical inspection rows, but detach them
-- from the deleted driver. Financial history already contains its own snapshot.
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

-- Update billing so every new financial operation stores a complete driver snapshot.
CREATE OR REPLACE FUNCTION public.charge_inspection_component(
    p_inspection_id bigint,
    p_component text,
    p_amount numeric DEFAULT 0.90
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_id bigint;
    v_driver_id bigint;
    v_driver_name text;
    v_driver_car_brand text;
    v_driver_car_number text;
    v_balance numeric;
    v_new_balance numeric;
    v_description text;
BEGIN
    IF p_component NOT IN ('medical', 'mechanic') THEN
        RAISE EXCEPTION 'Неизвестный компонент осмотра: %', p_component;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Сумма списания должна быть больше 0';
    END IF;

    SELECT
        d.id,
        d.customer_id,
        d.name,
        d.car_brand,
        d.car_number
    INTO
        v_driver_id,
        v_customer_id,
        v_driver_name,
        v_driver_car_brand,
        v_driver_car_number
    FROM public.inspections i
    JOIN public.drivers d ON d.id = i.driver_id
    WHERE i.id = p_inspection_id;

    IF v_customer_id IS NULL OR v_driver_id IS NULL THEN
        RAISE EXCEPTION
            'Не удалось определить заказчика и водителя для осмотра %',
            p_inspection_id;
    END IF;

    IF p_component = 'medical' THEN
        v_description := 'Списание за мед. осмотр';
    ELSE
        v_description := 'Списание за тех. осмотр';
    END IF;

    -- Idempotency: one charge per component and inspection.
    IF EXISTS (
        SELECT 1
        FROM public.customer_balance_transactions t
        WHERE t.inspection_id = p_inspection_id
          AND t.type = 'inspection'
          AND t.description = v_description
    ) THEN
        SELECT c.balance
        INTO v_balance
        FROM public.customers c
        WHERE c.id = v_customer_id;

        RETURN COALESCE(v_balance, 0);
    END IF;

    -- Lock customer balance for an atomic debit.
    SELECT c.balance
    INTO v_balance
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Заказчик % не найден', v_customer_id;
    END IF;

    IF v_balance < p_amount THEN
        RAISE EXCEPTION
            'Недостаточно средств на балансе заказчика. Требуется %.2f BYN, доступно %.2f BYN',
            p_amount,
            v_balance;
    END IF;

    v_new_balance := v_balance - p_amount;

    UPDATE public.customers
    SET balance = v_new_balance
    WHERE id = v_customer_id;

    INSERT INTO public.customer_balance_transactions (
        customer_id,
        amount,
        type,
        description,
        inspection_id,
        driver_id,
        driver_name,
        driver_car_brand,
        driver_car_number,
        balance_after
    )
    VALUES (
        v_customer_id,
        -p_amount,
        'inspection',
        v_description,
        p_inspection_id,
        v_driver_id,
        v_driver_name,
        v_driver_car_brand,
        v_driver_car_number,
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;

-- History no longer depends on the live drivers row.
-- If the driver still exists, use its current values; otherwise use the snapshot.
CREATE OR REPLACE FUNCTION public.get_customer_inspection_charges(p_customer_id bigint)
RETURNS TABLE (
    id bigint,
    customer_id bigint,
    amount numeric,
    type text,
    description text,
    inspection_id bigint,
    balance_after numeric,
    created_at timestamptz,
    driver_id bigint,
    driver_name text,
    car_brand text,
    car_number text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT
        t.id,
        t.customer_id,
        t.amount,
        t.type,
        t.description,
        t.inspection_id,
        t.balance_after,
        t.created_at,
        t.driver_id,
        COALESCE(d.name, t.driver_name) AS driver_name,
        COALESCE(d.car_brand, t.driver_car_brand) AS car_brand,
        COALESCE(d.car_number, t.driver_car_number) AS car_number
    FROM public.customer_balance_transactions t
    LEFT JOIN public.drivers d ON d.id = t.driver_id
    WHERE t.customer_id = p_customer_id
      AND t.amount < 0
      AND t.type = 'inspection'
    ORDER BY t.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_inspection_charges(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_inspection_charges(bigint) TO authenticated;

GRANT EXECUTE ON FUNCTION public.charge_inspection_component(bigint, text, numeric) TO authenticated;
