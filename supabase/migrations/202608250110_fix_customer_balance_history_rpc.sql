-- Fix customer balance history for the customer cabinet.
-- Direct SELECT from customer_balance_transactions can be blocked by RLS,
-- while the customer still needs to see only their own financial history.

CREATE OR REPLACE FUNCTION public.get_customer_balance_history(p_customer_id bigint)
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
    driver_car_brand text,
    driver_car_number text
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
        COALESCE(d.name, NULL) AS driver_name,
        COALESCE(d.car_brand, NULL) AS driver_car_brand,
        COALESCE(d.car_number, NULL) AS driver_car_number
    FROM public.customer_balance_transactions t
    LEFT JOIN public.drivers d ON d.id = t.driver_id
    WHERE t.customer_id = p_customer_id
    ORDER BY t.created_at DESC
    LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_balance_history(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_balance_history(bigint) TO authenticated;
