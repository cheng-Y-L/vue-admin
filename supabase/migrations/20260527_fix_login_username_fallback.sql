-- 修复：11 位纯数字用户名在手机号未命中时应回退到用户名查询
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

  return (
    select p.email from public.profiles p
    where lower(p.username) = lower(trimmed)
    limit 1
  );
end;
$$;

grant execute on function public.get_login_email_by_account(text) to anon, authenticated;
