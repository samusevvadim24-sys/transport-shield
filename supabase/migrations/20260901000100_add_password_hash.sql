-- Migrate application users from plaintext passwords to bcrypt hashes.
-- The legacy password column is intentionally kept during this migration so
-- existing user-management RPCs can continue to accept the current password.
-- It must be removed in a later migration after all writers are migrated.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash text;

-- Backfill every existing user without changing their password.
UPDATE public.users
SET password_hash = crypt(password, gen_salt('bf', 12))
WHERE password IS NOT NULL
  AND btrim(password) <> ''
  AND (password_hash IS NULL OR password_hash = '');

-- New users and password changes made by existing RPCs are hashed automatically.
CREATE OR REPLACE FUNCTION public.sync_user_password_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.password IS NOT NULL
     AND btrim(NEW.password) <> ''
     AND (
       TG_OP = 'INSERT'
       OR NEW.password IS DISTINCT FROM OLD.password
     )
  THEN
    NEW.password_hash := crypt(NEW.password, gen_salt('bf', 12));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_sync_password_hash ON public.users;

CREATE TRIGGER users_sync_password_hash
BEFORE INSERT OR UPDATE OF password
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_password_hash();

-- Do not allow the application to reach a state where a newly created user
-- has no password hash. Existing rows are validated before enforcing this.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE password_hash IS NULL OR btrim(password_hash) = ''
  ) THEN
    RAISE EXCEPTION 'Password hash migration incomplete: users without password_hash remain';
  END IF;
END;
$$;

ALTER TABLE public.users
  ALTER COLUMN password_hash SET NOT NULL;

COMMENT ON COLUMN public.users.password_hash IS
  'bcrypt password hash. Plaintext password column is legacy and must be removed after all writers are migrated.';
