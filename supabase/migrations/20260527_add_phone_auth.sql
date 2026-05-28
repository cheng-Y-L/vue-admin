-- 支持手机号 + 邮箱登录/注册

alter table public.profiles add column if not exists phone text;

create unique index if not exists profiles_phone_unique on public.profiles (phone) where phone is not null;

create or replace function public.is_phone_available(check_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where phone = check_phone);
$$;

grant execute on function public.is_phone_available(text) to anon, authenticated;

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
  if trimmed = '' then
    return null;
  end if;

  if position('@' in trimmed) > 0 then
    return (
      select p.email from public.profiles p
      where lower(p.email) = lower(trimmed)
      limit 1
    );
  end if;

  digits := regexp_replace(trimmed, '[^0-9]', '', 'g');
  if length(digits) = 13 and left(digits, 2) = '86' then
    normalized_phone := substring(digits from 3);
  else
    normalized_phone := digits;
  end if;

  if length(normalized_phone) = 11 then
    phone_email := (
      select p.email from public.profiles p
      where p.phone = normalized_phone
      limit 1
    );
    if phone_email is not null then
      return phone_email;
    end if;
  end if;

  -- 兼容旧版用户名登录（11 位纯数字用户名在手机号未命中时也会走此处）
  return (
    select p.email from public.profiles p
    where lower(p.username) = lower(trimmed)
    limit 1
  );
end;
$$;

grant execute on function public.get_login_email_by_account(text) to anon, authenticated;

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

  user_phone := nullif(meta->>'phone', '');

  if user_role = 'admin' then
    user_permissions := array['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view'];
  elsif user_role = 'publisher' then
    user_permissions := array['dashboard_view', 'order_manage', 'data_stats_view'];
  else
    user_permissions := array['dashboard_view', 'data_stats_view'];
  end if;

  insert into public.profiles (id, username, nickname, email, phone, role, permissions, avatar)
  values (
    new.id,
    coalesce(meta->>'username', split_part(new.email, '@', 1)),
    coalesce(meta->>'nickname', split_part(new.email, '@', 1)),
    new.email,
    user_phone,
    user_role,
    user_permissions,
    meta->>'avatar'
  );
  return new;
end;
$$;
