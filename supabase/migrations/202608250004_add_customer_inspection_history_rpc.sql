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
        d.name AS driver_name,
        d.car_brand,
        d.car_number
    FROM public.customer_balance_transactions t
    JOIN public.inspections i ON i.id = t.inspection_id
    JOIN public.drivers d ON d.id = i.driver_id
    WHERE t.customer_id = p_customer_id
      AND t.inspection_id IS NOT NULL
      AND t.amount < 0
    ORDER BY t.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_inspection_charges(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_inspection_charges(bigint) TO authenticated;
