-- Driver password hardening.
-- Keep the existing RPC argument names so the current frontend keeps working,
-- but never persist plaintext passwords. PostgreSQL pgcrypto generates a
-- bcrypt salt with its default cost (6); we raise the bcrypt cost in the salt
-- to 12 before crypt() hashes the password.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.create_driver_user(bigint, text, text);
DROP FUNCTION IF EXISTS public.update_driver_record(bigint, text, text, bigint, text, bigint, text, date, date, text, text, date, text, text, date);

CREATE OR REPLACE FUNCTION public.create_driver_user(
  p_admin_id bigint,
  p_login text,
  p_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Доступ запрещен: пользователь не является администратором';
  END IF;

  IF p_login IS NULL OR trim(p_login) = '' THEN
    RAISE EXCEPTION 'Логин обязателен';
  END IF;

  IF p_password IS NULL OR trim(p_password) = '' THEN
    RAISE EXCEPTION 'Пароль обязателен';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE login = trim(p_login)
  ) THEN
    RAISE EXCEPTION 'Пользователь с логином % уже существует', trim(p_login);
  END IF;

  INSERT INTO public.users (
    login,
    password,
    password_hash,
    role
  )
  VALUES (
    trim(p_login),
    NULL,
    crypt(p_password, replace(gen_salt('bf'), '$2a$06$', '$2a$12$')),
    'driver'
  )
  RETURNING id INTO v_user_id;

  RETURN json_build_object(
    'id', v_user_id,
    'login', trim(p_login),
    'role', 'driver'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_driver_record(
    p_admin_id bigint,
    p_car_brand text,
    p_car_number text,
    p_customer_id bigint,
    p_driver_code text,
    p_driver_id bigint,
    p_inspection_scope text,
    p_insurance_expiry date,
    p_license_expiry date,
    p_license_number text,
    p_login text,
    p_medical_expiry date,
    p_name text,
    p_password text,
    p_tech_inspection_expiry date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id bigint;
    v_result json;
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
        RAISE EXCEPTION 'Недопустимое значение inspection_scope: %', p_inspection_scope;
    END IF;

    SELECT d.user_id
    INTO v_user_id
    FROM public.drivers d
    WHERE d.id = p_driver_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Водитель с id % не найден', p_driver_id;
    END IF;

    UPDATE public.drivers
    SET
        name = NULLIF(TRIM(p_name), ''),
        car_brand = NULLIF(TRIM(p_car_brand), ''),
        car_number = NULLIF(TRIM(p_car_number), ''),
        customer_id = p_customer_id,
        driver_id = NULLIF(TRIM(p_driver_code), ''),
        insurance_expiry = p_insurance_expiry,
        license_expiry = p_license_expiry,
        license_number = NULLIF(TRIM(p_license_number), ''),
        medical_expiry = p_medical_expiry,
        tech_inspection_expiry = p_tech_inspection_expiry,
        inspection_scope = p_inspection_scope
    WHERE id = p_driver_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Не удалось обновить запись водителя';
    END IF;

    IF NULLIF(TRIM(p_login), '') IS NOT NULL THEN
        UPDATE public.users
        SET login = TRIM(p_login)
        WHERE id = v_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Не удалось обновить логин водителя';
        END IF;
    END IF;

    IF NULLIF(TRIM(p_password), '') IS NOT NULL THEN
        UPDATE public.users
        SET
            password_hash = crypt(p_password, replace(gen_salt('bf'), '$2a$06$', '$2a$12$')),
            password = NULL
        WHERE id = v_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Не удалось обновить пароль водителя';
        END IF;
    END IF;

    SELECT row_to_json(d)
    INTO v_result
    FROM public.drivers d
    WHERE d.id = p_driver_id;

    RETURN v_result;
END;
$function$;
