-- 律师执业证图片：profiles 字段 + Storage 桶与策略

alter table public.profiles add column if not exists license_image_url text;

insert into storage.buckets (id, name, public)
values ('lawyer-licenses', 'lawyer-licenses', false)
on conflict (id) do nothing;

-- 律师仅可向本人目录上传/更新/删除
create policy "lawyer_licenses_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lawyer-licenses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lawyer_licenses_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'lawyer-licenses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lawyer_licenses_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lawyer-licenses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 已登录用户可读取（管理员审核、律师本人预览）
create policy "lawyer_licenses_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lawyer-licenses');
