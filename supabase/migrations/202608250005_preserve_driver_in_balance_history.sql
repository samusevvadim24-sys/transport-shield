-- Keep financial history independent from the lifetime of an inspection.
-- The inspection may be deleted, but the balance transaction must remain visible.

ALTER TABLE public.customer_balance_transactions
ADD COLUMN IF NOT EXISTS driver_id bigint;

-- Preserve the driver for all existing transactions whose inspection still exists.
UPDATE public.customer_balance_transactions t
SET driver_id = i.driver_id
FROM public.inspections i
WHERE t.inspection_id = i.id
  AND t.driver_id IS NULL;

-- Do not add a foreign key to inspections here: inspection deletion must not
-- delete the financial operation. driver_id is intentionally stored as a
-- snapshot/reference on the transaction.

-- Remove the old unique index that allowed only one inspection transaction
-- when type='inspection'. Medical and mechanic are two separate charges.
DROP INDEX IF EXISTS public.idx_customer_balance_transactions_inspection;

-- A component can be charged only once for the same inspection.
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_transactions_inspection_description
ON public.customer_balance_transactions (inspection_id, description)
WHERE inspection_id IS NOT NULL
  AND type = 'inspection'
  AND description IS NOT NULL;

-- Update billing so every new transaction stores the driver_id.
-- Keep type='inspection' because the existing database constraint allows
-- 'deposit' and 'inspection'. The description identifies the component.
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

    SELECT d.id, d.customer_id
    INTO v_driver_id, v_customer_id
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
        balance_after
    )
    VALUES (
        v_customer_id,
        -p_amount,
        'inspection',
        v_description,
        p_inspection_id,
        v_driver_id,
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;

-- History must not require the inspection row to exist.
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
        d.name AS driver_name,
        d.car_brand,
        d.car_number
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
