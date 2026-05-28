-- 将 editor/viewer 更名为 publisher/lawyer（发布侧/律师）
update public.profiles set role = 'publisher' where role = 'editor';
update public.profiles set role = 'lawyer' where role = 'viewer';

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  alter column role set default 'lawyer';

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'publisher', 'lawyer'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  user_role text;
  user_permissions text[];
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  user_role := coalesce(meta->>'role', 'lawyer');
  if user_role = 'editor' then user_role := 'publisher'; end if;
  if user_role = 'viewer' then user_role := 'lawyer'; end if;

  if user_role = 'admin' then
    user_permissions := array['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view'];
  elsif user_role = 'publisher' then
    user_permissions := array['dashboard_view', 'order_manage', 'data_stats_view'];
  else
    user_permissions := array['dashboard_view', 'data_stats_view'];
  end if;

  insert into public.profiles (id, username, nickname, email, role, permissions, avatar)
  values (
    new.id,
    coalesce(meta->>'username', split_part(new.email, '@', 1)),
    coalesce(meta->>'nickname', split_part(new.email, '@', 1)),
    new.email,
    user_role,
    user_permissions,
    meta->>'avatar'
  );
  return new;
end;
$$;
