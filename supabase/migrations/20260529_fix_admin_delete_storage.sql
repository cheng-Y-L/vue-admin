-- 修复 admin_delete_user：禁止直接删 storage.objects；管理员可通过 API 删律师证文件

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

-- 管理员删除任意用户的律师证 Storage 对象（删除用户前由前端调用）
drop policy if exists "lawyer_licenses_delete_admin" on storage.objects;
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
