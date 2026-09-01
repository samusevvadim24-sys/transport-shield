-- Server-side authentication sessions.
-- The browser keeps only an opaque token in an HttpOnly cookie.
-- The database stores only a SHA-256 hash of that token and can revoke it immediately.

CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON public.auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON public.auth_sessions(expires_at);

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_auth_session(
    p_user_id bigint,
    p_token_hash text,
    p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF p_user_id IS NULL OR p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
        RAISE EXCEPTION 'Некорректные данные сессии';
    END IF;

    IF p_expires_at IS NULL OR p_expires_at <= now() THEN
        RAISE EXCEPTION 'Срок действия сессии должен быть в будущем';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Пользователь с ID % не найден', p_user_id;
    END IF;

    INSERT INTO public.auth_sessions (user_id, token_hash, expires_at)
    VALUES (p_user_id, p_token_hash, p_expires_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_auth_session(p_token_hash text)
RETURNS TABLE (
    id bigint,
    login text,
    role text,
    inspection_point_id bigint,
    expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT
        u.id,
        u.login,
        u.role::text,
        u.inspection_point_id,
        s.expires_at
    FROM public.auth_sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.token_hash = p_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_auth_session(p_token_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    UPDATE public.auth_sessions
    SET revoked_at = COALESCE(revoked_at, now())
    WHERE token_hash = p_token_hash;
$function$;

REVOKE ALL ON TABLE public.auth_sessions FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auth_session(bigint, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_auth_session(text) TO anon, authenticated;
