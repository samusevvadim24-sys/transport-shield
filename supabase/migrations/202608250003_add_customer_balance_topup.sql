-- Manual customer balance top-up.
-- The balance itself remains the source of truth; every top-up is also recorded
-- in customer_balance_transactions for an auditable operation history.

CREATE OR REPLACE FUNCTION public.top_up_customer_balance(
    p_customer_id bigint,
    p_amount numeric,
    p_description text DEFAULT 'Пополнение баланса'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance numeric;
    v_new_balance numeric;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Сумма пополнения должна быть больше 0';
    END IF;

    SELECT balance
    INTO v_balance
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Заказчик % не найден', p_customer_id;
    END IF;

    v_new_balance := COALESCE(v_balance, 0) + p_amount;

    UPDATE public.customers
    SET balance = v_new_balance
    WHERE id = p_customer_id;

    INSERT INTO public.customer_balance_transactions (
        customer_id,
        amount,
        type,
        description,
        balance_after
    )
    VALUES (
        p_customer_id,
        p_amount,
        'top_up',
        NULLIF(TRIM(p_description), ''),
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.top_up_customer_balance(bigint, numeric, text) TO authenticated;
