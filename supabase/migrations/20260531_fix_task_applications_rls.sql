-- 修复 task_applications INSERT 策略自引用导致的 infinite recursion

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

drop policy if exists "task_applications_insert" on public.task_applications;

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
