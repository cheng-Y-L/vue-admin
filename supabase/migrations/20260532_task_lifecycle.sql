-- 任务状态机扩展：待确认完成、争议中；律师过程提交

-- 扩展 tasks.status 约束
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('draft', 'pending', 'in_progress', 'awaiting_completion', 'completed', 'disputed', 'closed'));

-- 律师活跃任务：进行中 / 待确认完成 / 争议中 均不可申请新任务
create or replace function public.lawyer_has_active_task(check_lawyer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks
    where assigned_lawyer_id = check_lawyer_id
      and status in ('in_progress', 'awaiting_completion', 'disputed')
  );
$$;

-- 律师过程提交（阶段性报告/文件）
create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  attachment_urls text[] not null default '{}',
  submission_type text not null default 'progress'
    check (submission_type in ('progress', 'completion')),
  created_at timestamptz not null default now()
);

create index if not exists task_submissions_task_id_idx on public.task_submissions (task_id);
create index if not exists task_submissions_lawyer_id_idx on public.task_submissions (lawyer_id);

alter table public.task_submissions enable row level security;

-- 律师、发布方、管理员可查看
create policy "task_submissions_select"
  on public.task_submissions for select
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

-- 已分配律师可在进行中任务提交过程材料
create policy "task_submissions_insert"
  on public.task_submissions for insert
  to authenticated
  with check (
    lawyer_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.assigned_lawyer_id = auth.uid()
        and t.status = 'in_progress'
    )
  );

-- 更新 tasks 查询策略：律师可见分配给自己的新状态任务
drop policy if exists "tasks_select" on public.tasks;
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
      status in ('pending', 'in_progress', 'awaiting_completion', 'completed', 'disputed')
      and (
        assigned_lawyer_id = auth.uid()
        or (status = 'pending' and assigned_lawyer_id is null)
      )
    )
  );

-- 发布方可更新待确认完成/争议中任务的状态
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update"
  on public.tasks for update
  to authenticated
  using (
    (
      publisher_id = auth.uid()
      and status in ('draft', 'pending', 'in_progress', 'awaiting_completion', 'disputed')
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
    or (
      assigned_lawyer_id = auth.uid()
      and status = 'in_progress'
    )
  )
  with check (
    publisher_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
    )
    or assigned_lawyer_id = auth.uid()
  );
