-- Preserve driver identity in balance history even after the driver is deleted.
-- driver_id alone is not enough because the drivers row can disappear.

ALTER TABLE public.customer_balance_transactions
    ADD COLUMN IF NOT EXISTS driver_name text,
    ADD COLUMN IF NOT EXISTS driver_car_brand text,
    ADD COLUMN IF NOT EXISTS driver_car_number text;

-- Backfill snapshots for existing transactions while the driver rows still exist.
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

-- Billing now stores a snapshot of the driver together with driver_id.
-- The snapshot remains available after DELETE FROM drivers.
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
        RAISE EXCEPTION 'Не удалось определить заказчика и водителя для осмотра %', p_inspection_id;
    END IF;

    IF p_component = 'medical' THEN
        v_description := 'Списание за мед. осмотр';
    ELSE
        v_description := 'Списание за тех. осмотр';
    END IF;

    -- Idempotency: the same component of the same inspection is charged once.
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

    -- Lock the customer's balance for an atomic debit.
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

-- History uses the stored driver snapshot first, so it remains intact
-- even after the driver row has been deleted.
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
        COALESCE(t.driver_name, d.name) AS driver_name,
        COALESCE(t.driver_car_brand, d.car_brand) AS car_brand,
        COALESCE(t.driver_car_number, d.car_number) AS car_number
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
