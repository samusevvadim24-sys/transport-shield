create or replace function public.delete_driver_and_user(
  p_admin_id integer,
  p_driver_id integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  if p_admin_id is null or p_driver_id is null then
    raise exception 'Некорректные параметры удаления';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_admin_id
      and role = 'admin'
  ) then
    raise exception 'Недостаточно прав для удаления водителя';
  end if;

  select user_id
    into v_user_id
  from public.drivers
  where id = p_driver_id
  for update;

  if not found then
    raise exception 'Водитель не найден';
  end if;

  delete from public.drivers
  where id = p_driver_id;

  if v_user_id is not null then
    delete from public.users
    where id = v_user_id;
  end if;
end;
$$;

revoke all on function public.delete_driver_and_user(integer, integer) from public;
grant execute on function public.delete_driver_and_user(integer, integer) to service_role;
