-- Update drivers through a SECURITY DEFINER RPC so admin RLS does not block edits.
CREATE OR REPLACE FUNCTION public.update_driver_record(
    p_admin_id bigint,
    p_driver_id bigint,
    p_name text,
    p_car_brand text,
    p_car_number text,
    p_customer_id bigint,
    p_driver_code text,
    p_insurance_expiry date,
    p_license_expiry date,
    p_license_number text,
    p_medical_expiry date,
    p_tech_inspection_expiry date,
    p_inspection_scope text,
    p_login text,
    p_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id bigint;
    v_driver jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_admin_id
          AND u.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Недостаточно прав для изменения водителя';
    END IF;

    IF p_inspection_scope NOT IN ('medical', 'mechanic', 'both') THEN
        RAISE EXCEPTION 'Некорректный тип осмотра водителя';
    END IF;

    SELECT d.user_id
    INTO v_user_id
    FROM public.drivers d
    WHERE d.id = p_driver_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Водитель не найден';
    END IF;

    IF p_login IS NOT NULL AND btrim(p_login) <> '' THEN
        UPDATE public.users
        SET login = btrim(p_login),
            password = CASE
                WHEN p_password IS NOT NULL AND btrim(p_password) <> ''
                    THEN p_password
                ELSE password
            END
        WHERE id = v_user_id;
    ELSIF p_password IS NOT NULL AND btrim(p_password) <> '' THEN
        UPDATE public.users
        SET password = p_password
        WHERE id = v_user_id;
    END IF;

    UPDATE public.drivers
    SET name = btrim(COALESCE(p_name, '')),
        car_brand = btrim(COALESCE(p_car_brand, '')),
        car_number = btrim(COALESCE(p_car_number, '')),
        customer_id = p_customer_id,
        driver_id = NULLIF(btrim(COALESCE(p_driver_code, '')), ''),
        insurance_expiry = p_insurance_expiry,
        license_expiry = p_license_expiry,
        license_number = NULLIF(btrim(COALESCE(p_license_number, '')), ''),
        medical_expiry = p_medical_expiry,
        tech_inspection_expiry = p_tech_inspection_expiry,
        inspection_scope = p_inspection_scope
    WHERE id = p_driver_id
    RETURNING to_jsonb(drivers.*)
    INTO v_driver;

    IF v_driver IS NULL THEN
        RAISE EXCEPTION 'Не удалось сохранить изменения водителя';
    END IF;

    RETURN v_driver;
END;
$$;

REVOKE ALL ON FUNCTION public.update_driver_record(
    bigint, bigint, text, text, text, bigint, text, date, date, text, date, date, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_driver_record(
    bigint, bigint, text, text, text, bigint, text, date, date, text, date, date, text, text, text
) TO anon, authenticated;
