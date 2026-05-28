-- 修复注册报错 "Database error saving new user"
-- 常见原因：缺少 phone/certification_status 列、role 约束仍是 editor/viewer、触发器版本过旧

-- 1. 补齐 profiles 列
alter table public.profiles add column if not exists phone text;
alter table public.profiles
  add column if not exists certification_status text not null default 'none'
    check (certification_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists real_name text;
alter table public.profiles add column if not exists id_card text;
alter table public.profiles add column if not exists law_firm text;
alter table public.profiles add column if not exists license_number text;
alter table public.profiles add column if not exists practice_area text;

create unique index if not exists profiles_phone_unique
  on public.profiles (phone) where phone is not null;

-- 2. 角色约束（前端注册传 lawyer/publisher，旧库可能仍是 editor/viewer）
update public.profiles set role = 'publisher' where role = 'editor';
update public.profiles set role = 'lawyer' where role = 'viewer';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles alter column role set default 'lawyer';
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'publisher', 'lawyer'));

-- 3. 统一注册触发器（写入 phone、certification_status，兼容旧 role 名）
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
  user_phone text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  user_role := coalesce(meta->>'role', 'lawyer');
  if user_role = 'editor' then user_role := 'publisher'; end if;
  if user_role = 'viewer' then user_role := 'lawyer'; end if;
  if user_role not in ('admin', 'publisher', 'lawyer') then
    user_role := 'lawyer';
  end if;

  user_phone := nullif(meta->>'phone', '');

  if user_role = 'admin' then
    user_permissions := array['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view'];
  elsif user_role = 'publisher' then
    user_permissions := array['dashboard_view', 'order_manage', 'data_stats_view'];
  else
    user_permissions := array['dashboard_view', 'data_stats_view'];
  end if;

  insert into public.profiles (
    id, username, nickname, email, phone, certification_status, role, permissions, avatar
  )
  values (
    new.id,
    coalesce(meta->>'username', split_part(new.email, '@', 1)),
    coalesce(meta->>'nickname', split_part(new.email, '@', 1)),
    new.email,
    user_phone,
    'none',
    user_role,
    user_permissions,
    meta->>'avatar'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. 手机号校验 RPC（注册页会调用）
create or replace function public.is_phone_available(check_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where phone = check_phone);
$$;

grant execute on function public.is_phone_available(text) to anon, authenticated;
