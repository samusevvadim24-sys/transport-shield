-- Use administrator-configured prices for inspection billing.
-- The amount recorded in balance history is the price from system_settings
-- at the moment the inspection component is completed.

CREATE OR REPLACE FUNCTION public.charge_inspection_component(
    p_inspection_id bigint,
    p_component text,
    p_amount numeric DEFAULT NULL
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
    v_amount numeric;
BEGIN
    IF p_component NOT IN ('medical', 'mechanic') THEN
        RAISE EXCEPTION 'Неизвестный компонент осмотра: %', p_component;
    END IF;

    -- The price is always taken from administrator settings.
    -- p_amount is kept only for RPC signature compatibility and is intentionally ignored.
    SELECT CASE
        WHEN p_component = 'medical' THEN medical_inspection_price
        ELSE mechanic_inspection_price
    END
    INTO v_amount
    FROM public.system_settings
    WHERE id = 1;

    IF v_amount IS NULL THEN
        RAISE EXCEPTION 'Не найдены настройки стоимости осмотра';
    END IF;

    IF v_amount <= 0 THEN
        RAISE EXCEPTION 'Стоимость осмотра должна быть больше 0';
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
        v_description := format('Списание за мед. осмотр (%.2f BYN)', v_amount);
    ELSE
        v_type := 'mechanic_charge';
        v_description := format('Списание за тех. осмотр (%.2f BYN)', v_amount);
    END IF;

    -- Prevent charging the same component twice.
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

    -- Lock the customer balance during the transaction.
    SELECT c.balance
    INTO v_balance
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Заказчик % не найден', v_customer_id;
    END IF;

    IF v_balance < v_amount THEN
        RAISE EXCEPTION
            'Недостаточно средств на балансе заказчика. Требуется %.2f BYN, доступно %.2f BYN',
            v_amount,
            v_balance;
    END IF;

    v_new_balance := v_balance - v_amount;

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
        -v_amount,
        v_type,
        v_description,
        p_inspection_id,
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_customer_balance_component(
    p_customer_id bigint,
    p_inspection_id bigint,
    p_component text,
    p_amount numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_driver_customer_id bigint;
BEGIN
    SELECT d.customer_id
    INTO v_driver_customer_id
    FROM public.inspections i
    JOIN public.drivers d ON d.id = i.driver_id
    WHERE i.id = p_inspection_id;

    IF v_driver_customer_id IS NULL THEN
        RAISE EXCEPTION 'Осмотр % не найден', p_inspection_id;
    END IF;

    IF v_driver_customer_id <> p_customer_id THEN
        RAISE EXCEPTION 'Осмотр % не принадлежит заказчику %', p_inspection_id, p_customer_id;
    END IF;

    RETURN public.charge_inspection_component(
        p_inspection_id,
        p_component,
        NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.bill_inspection_components()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.medical_status IN ('Допущен', 'Не допущен')
       AND COALESCE(OLD.medical_status, 'Ожидание') NOT IN ('Допущен', 'Не допущен') THEN
        PERFORM public.charge_inspection_component(NEW.id, 'medical', NULL);
    END IF;

    IF NEW.mechanic_status IN ('Допущен', 'Не допущен')
       AND COALESCE(OLD.mechanic_status, 'Ожидание') NOT IN ('Допущен', 'Не допущен') THEN
        PERFORM public.charge_inspection_component(NEW.id, 'mechanic', NULL);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_inspection_components ON public.inspections;

CREATE TRIGGER trg_bill_inspection_components
AFTER UPDATE OF medical_status, mechanic_status ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.bill_inspection_components();
