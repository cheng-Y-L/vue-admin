-- 在 Supabase SQL Editor 中执行此脚本

-- 用户档案表（关联 auth.users）
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  nickname text not null,
  email text not null,
  phone text,
  certification_status text not null default 'none' check (certification_status in ('none', 'pending', 'approved', 'rejected')),
  real_name text,
  id_card text,
  law_firm text,
  license_number text,
  license_image_url text,
  practice_area text,
  role text not null default 'lawyer' check (role in ('admin', 'publisher', 'lawyer')),
  permissions text[] not null default array['dashboard_view', 'data_stats_view'],
  status text not null default 'active' check (status in ('active', 'suspended')),
  avatar text,
  create_time timestamptz not null default now()
);

-- 已有库升级：create table if not exists 不会补列，需单独 alter
alter table public.profiles add column if not exists phone text;
alter table public.profiles
  add column if not exists certification_status text not null default 'none'
    check (certification_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists real_name text;
alter table public.profiles add column if not exists id_card text;
alter table public.profiles add column if not exists law_firm text;
alter table public.profiles add column if not exists license_number text;
alter table public.profiles add column if not exists license_image_url text;
alter table public.profiles add column if not exists practice_area text;

create unique index if not exists profiles_phone_unique on public.profiles (phone) where phone is not null;

alter table public.profiles enable row level security;

-- 已登录用户可读取所有档案（管理后台需要）
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- 用户可更新自己的档案（昵称、头像）
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 管理员可更新任意档案
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
  );

-- 管理员可删除档案
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
  );

-- 注册时由触发器插入档案
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
    user_permissions := array['dashboard_view', 'user_manage', 'order_manage', 'task_manage', 'system_logs_view', 'data_stats_view'];
  elsif user_role = 'publisher' then
    user_permissions := array['dashboard_view', 'order_manage', 'task_manage', 'data_stats_view'];
  else
    user_permissions := array['dashboard_view', 'data_stats_view'];
  end if;

  insert into public.profiles (id, username, nickname, email, phone, certification_status, role, permissions, avatar)
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

-- 检查用户名是否可用（注册前调用）
create or replace function public.is_username_available(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(check_username)
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- 登录前根据用户名解析邮箱（anon 无法直接查 profiles）
create or replace function public.get_login_email_by_username(check_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles
  where lower(username) = lower(trim(check_username))
  limit 1;
$$;

grant execute on function public.get_login_email_by_username(text) to anon, authenticated;

-- 登录前根据手机号或邮箱解析 Auth 邮箱
create or replace function public.get_login_email_by_account(account text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text;
  digits text;
  normalized_phone text;
  phone_email text;
begin
  trimmed := trim(account);
  if trimmed = '' then return null; end if;

  if position('@' in trimmed) > 0 then
    return (select p.email from public.profiles p where lower(p.email) = lower(trimmed) limit 1);
  end if;

  digits := regexp_replace(trimmed, '[^0-9]', '', 'g');
  if length(digits) = 13 and left(digits, 2) = '86' then
    normalized_phone := substring(digits from 3);
  else
    normalized_phone := digits;
  end if;

  if length(normalized_phone) = 11 then
    phone_email := (select p.email from public.profiles p where p.phone = normalized_phone limit 1);
    if phone_email is not null then
      return phone_email;
    end if;
  end if;

  return (select p.email from public.profiles p where lower(p.username) = lower(trimmed) limit 1);
end;
$$;

grant execute on function public.get_login_email_by_account(text) to anon, authenticated;

-- 检查手机号是否可用（注册前调用，客户端传入已规范化的 11 位号码）
create or replace function public.is_phone_available(check_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where phone = check_phone);
$$;

grant execute on function public.is_phone_available(text) to anon, authenticated;

-- 管理员删除用户（同步删除 auth.users，profiles 随 FK cascade 删除）
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if target_user_id is null then
    raise exception '无效的用户 ID';
  end if;

  if target_user_id = auth.uid() then
    raise exception '不能删除自己的账号';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception '无权删除用户';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception '用户不存在';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 管理员可通过 Storage API 删除任意用户的律师证文件
create policy "lawyer_licenses_delete_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lawyer-licenses'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and status = 'active'
    )
  );

-- 将首个注册用户提升为管理员（按需修改邮箱后执行）:
-- update public.profiles
-- set role = 'admin',
--     permissions = array['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view']
-- where email = 'your@email.com';
