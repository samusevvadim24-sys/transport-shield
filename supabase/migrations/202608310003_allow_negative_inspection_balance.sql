-- Allow inspection charges to take the customer's balance below zero.
-- The balance check is intentionally removed: inspections are not blocked
-- when the customer has insufficient funds.

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
    v_balance numeric;
    v_new_balance numeric;
    v_type text;
    v_description text;
BEGIN
    IF p_component NOT IN ('medical', 'mechanic') THEN
        RAISE EXCEPTION 'Неизвестный компонент осмотра: %', p_component;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Сумма списания должна быть больше 0';
    END IF;

    SELECT d.customer_id
    INTO v_customer_id
    FROM public.inspections i
    JOIN public.drivers d ON d.id = i.driver_id
    WHERE i.id = p_inspection_id;

    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Не удалось определить заказчика для осмотра %', p_inspection_id;
    END IF;

    IF p_component = 'medical' THEN
        v_type := 'medical_charge';
        v_description := 'Списание за мед. осмотр';
    ELSE
        v_type := 'mechanic_charge';
        v_description := 'Списание за тех. осмотр';
    END IF;

    -- Protect against charging the same inspection component twice.
    IF EXISTS (
        SELECT 1
        FROM public.customer_balance_transactions t
        WHERE t.inspection_id = p_inspection_id
          AND t.type = v_type
    ) THEN
        SELECT c.balance
        INTO v_balance
        FROM public.customers c
        WHERE c.id = v_customer_id;

        RETURN COALESCE(v_balance, 0);
    END IF;

    -- Lock the customer's balance during the operation.
    SELECT c.balance
    INTO v_balance
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Заказчик % не найден', v_customer_id;
    END IF;

    -- Negative balance is allowed. The inspection must not be blocked
    -- because the customer has insufficient funds.
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
        balance_after
    )
    VALUES (
        v_customer_id,
        -p_amount,
        v_type,
        v_description,
        p_inspection_id,
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;
