-- Migrate customer creation to receive a bcrypt hash from the application.
-- Plaintext passwords are never written to public.users.

DROP FUNCTION IF EXISTS public.create_customer_with_user(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  date,
  text,
  text
);

CREATE FUNCTION public.create_customer_with_user(
    p_number text,
    p_name text,
    p_password_hash text,
    p_type text DEFAULT NULL::text,
    p_unp text DEFAULT NULL::text,
    p_address text DEFAULT NULL::text,
    p_phone text DEFAULT NULL::text,
    p_email text DEFAULT NULL::text,
    p_contact_person text DEFAULT NULL::text,
    p_bank_name text DEFAULT NULL::text,
    p_bank_account text DEFAULT NULL::text,
    p_contract_number text DEFAULT NULL::text,
    p_contract_date date DEFAULT NULL::date,
    p_registration_number text DEFAULT NULL::text,
    p_registration_date date DEFAULT NULL::date,
    p_director_name text DEFAULT NULL::text,
    p_bank_bic text DEFAULT NULL::text
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id bigint;
    v_customer public.customers;
BEGIN
    IF p_number IS NULL OR btrim(p_number) = '' THEN
        RAISE EXCEPTION 'Номер заказчика обязателен';
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'Название заказчика обязательно';
    END IF;

    IF p_password_hash IS NULL OR btrim(p_password_hash) = '' THEN
        RAISE EXCEPTION 'Хеш пароля обязателен';
    END IF;

    IF p_password_hash !~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$' THEN
        RAISE EXCEPTION 'Некорректный bcrypt password_hash';
    END IF;

    INSERT INTO public.users (
        login,
        password,
        password_hash,
        role
    )
    VALUES (
        btrim(p_number),
        NULL,
        p_password_hash,
        'customer'
    )
    RETURNING id INTO v_user_id;

    INSERT INTO public.customers (
        created_at,
        user_id,
        number,
        name,
        type,
        unp,
        address,
        phone,
        email,
        contact_person,
        bank_name,
        bank_account,
        contract_number,
        contract_date,
        registration_number,
        registration_date,
        director_name,
        bank_bic
    )
    VALUES (
        now(),
        v_user_id,
        p_number,
        p_name,
        p_type,
        p_unp,
        p_address,
        p_phone,
        p_email,
        p_contact_person,
        p_bank_name,
        p_bank_account,
        p_contract_number,
        p_contract_date,
        p_registration_number,
        p_registration_date,
        p_director_name,
        p_bank_bic
    )
    RETURNING * INTO v_customer;

    RETURN v_customer;

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Заказчик с номером "%" уже существует', p_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_customer_with_user(
  text, text, text, text, text, text, text, text, text, text,
  text, date, text, date, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_customer_with_user(
  text, text, text, text, text, text, text, text, text, text,
  text, date, text, date, text, text, text
) TO anon, authenticated;
