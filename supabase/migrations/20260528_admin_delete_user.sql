-- 管理员删除用户：同步删除 auth.users（profiles 随 FK cascade 删除）

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

  -- Storage 文件由前端通过 Storage API 删除（见 removeLawyerLicenseFilesForUser）
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
