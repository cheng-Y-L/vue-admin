-- 任务发布与管理（发布方侧）

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  task_type text not null,
  region text not null,
  description text not null default '',
  budget numeric(12, 2),
  deadline timestamptz,
  attachment_urls text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'in_progress', 'completed', 'closed')),
  assigned_lawyer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_publisher_id_idx on public.tasks (publisher_id);
create index if not exists tasks_status_idx on public.tasks (status);

alter table public.tasks enable row level security;

-- 发布方查看自己的任务；管理员查看全部；律师查看待承接及分配给自己的任务
create policy "tasks_select"
  on public.tasks for select
  to authenticated
  using (
    publisher_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
    or (
      status in ('pending', 'in_progress', 'completed')
      and (
        assigned_lawyer_id = auth.uid()
        or (status = 'pending' and assigned_lawyer_id is null)
      )
    )
  );

-- 发布方和管理员可插入
create policy "tasks_insert"
  on public.tasks for insert
  to authenticated
  with check (
    publisher_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
  );

-- 发布方可编辑/关闭未完结任务；管理员可编辑全部
create policy "tasks_update"
  on public.tasks for update
  to authenticated
  using (
    (
      publisher_id = auth.uid()
      and status in ('draft', 'pending', 'in_progress')
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
  )
  with check (
    publisher_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
  );

-- 仅草稿可物理删除
create policy "tasks_delete"
  on public.tasks for delete
  to authenticated
  using (
    publisher_id = auth.uid() and status = 'draft'
  );

-- 更新 handle_new_user 默认权限：发布方增加 task_manage
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

-- 任务附件 Storage bucket（需在 Dashboard 创建 bucket 或执行 storage 策略）
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy "task_attachments_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'task-attachments');

create policy "task_attachments_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "task_attachments_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
