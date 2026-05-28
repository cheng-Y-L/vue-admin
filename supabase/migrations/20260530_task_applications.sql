-- 律师任务申请与承接

create table if not exists public.task_applications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  proposal text not null default '',
  quote numeric(12, 2),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_applications_task_id_idx on public.task_applications (task_id);
create index if not exists task_applications_lawyer_id_idx on public.task_applications (lawyer_id);
create index if not exists task_applications_status_idx on public.task_applications (status);

-- 同一律师同时只能有一条待审核申请
create unique index if not exists task_applications_one_pending_per_lawyer_idx
  on public.task_applications (lawyer_id)
  where status = 'pending';

-- 同一律师对同一任务不可重复有效申请
create unique index if not exists task_applications_active_per_task_lawyer_idx
  on public.task_applications (task_id, lawyer_id)
  where status in ('pending', 'accepted');

alter table public.task_applications enable row level security;

-- 供 RLS 使用，避免在 policy 内直接查询 task_applications 导致无限递归
create or replace function public.lawyer_has_pending_application(check_lawyer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.task_applications
    where lawyer_id = check_lawyer_id and status = 'pending'
  );
$$;

create or replace function public.lawyer_has_active_task(check_lawyer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks
    where assigned_lawyer_id = check_lawyer_id and status = 'in_progress'
  );
$$;

grant execute on function public.lawyer_has_pending_application(uuid) to authenticated;
grant execute on function public.lawyer_has_active_task(uuid) to authenticated;

-- 律师查看自己的申请；发布方查看自己任务的申请；管理员全部
create policy "task_applications_select"
  on public.task_applications for select
  to authenticated
  using (
    lawyer_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where t.id = task_id and t.publisher_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
  );

-- 已认证律师可对开放任务提交申请（应用层校验「仅一条待审申请」）
create policy "task_applications_insert"
  on public.task_applications for insert
  to authenticated
  with check (
    lawyer_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'lawyer'
        and p.status = 'active'
        and p.certification_status = 'approved'
    )
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.status = 'pending'
        and t.assigned_lawyer_id is null
    )
    and not public.lawyer_has_pending_application(auth.uid())
    and not public.lawyer_has_active_task(auth.uid())
  );

-- 律师撤回待审申请；发布方审核；管理员全部
create policy "task_applications_update"
  on public.task_applications for update
  to authenticated
  using (
    (
      lawyer_id = auth.uid()
      and status = 'pending'
    )
    or exists (
      select 1 from public.tasks t
      where t.id = task_id and t.publisher_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
  )
  with check (true);

-- 律师注册默认增加 task_browse
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
    user_permissions := array['dashboard_view', 'data_stats_view', 'task_browse'];
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

update public.profiles
set permissions = array_append(permissions, 'task_browse')
where role = 'lawyer'
  and not ('task_browse' = any(permissions));
