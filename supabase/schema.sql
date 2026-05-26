-- 在 Supabase SQL Editor 中执行此脚本

-- 用户档案表（关联 auth.users）
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  nickname text not null,
  email text not null,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  permissions text[] not null default array['dashboard_view', 'data_stats_view'],
  status text not null default 'active' check (status in ('active', 'suspended')),
  avatar text,
  create_time timestamptz not null default now()
);

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
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  user_role := coalesce(meta->>'role', 'viewer');

  if user_role = 'admin' then
    user_permissions := array['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view'];
  elsif user_role = 'editor' then
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

-- 将首个注册用户提升为管理员（按需修改邮箱后执行）:
-- update public.profiles
-- set role = 'admin',
--     permissions = array['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view']
-- where email = 'your@email.com';
