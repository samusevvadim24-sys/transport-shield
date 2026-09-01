create or replace function public.get_auth_session(p_token_hash text)
returns table(
  id bigint,
  user_id bigint,
  login text,
  role text,
  inspection_point_id bigint,
  expires_at timestamp with time zone
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    s.user_id,
    u.login,
    u.role,
    u.inspection_point_id,
    s.expires_at
  from public.auth_sessions s
  join public.users u
    on u.id = s.user_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
  limit 1;
$$;
