-- Remove the legacy plaintext password column.
-- All users must have a bcrypt password_hash before this migration is applied.
-- The application and user-management RPCs now use password_hash exclusively.

DO $$
DECLARE
    v_total_users bigint;
    v_users_without_hash bigint;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE password_hash IS NULL OR btrim(password_hash) = '')
    INTO v_total_users, v_users_without_hash
    FROM public.users;

    IF v_users_without_hash > 0 THEN
        RAISE EXCEPTION
            'Cannot remove users.password: % of % users have no password_hash',
            v_users_without_hash,
            v_total_users;
    END IF;
END;
$$;

ALTER TABLE public.users
    DROP COLUMN IF EXISTS password;
