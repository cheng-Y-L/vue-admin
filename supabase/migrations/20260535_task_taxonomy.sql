-- 任务分类与地域基础数据（管理员可维护）

create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#94a3b8',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.task_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists task_categories_sort_idx on public.task_categories (sort_order, name);
create index if not exists task_regions_sort_idx on public.task_regions (sort_order, name);

alter table public.task_categories enable row level security;
alter table public.task_regions enable row level security;

-- 所有登录用户可读启用项
create policy "task_categories_select"
  on public.task_categories for select
  to authenticated
  using (is_active = true or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));

create policy "task_regions_select"
  on public.task_regions for select
  to authenticated
  using (is_active = true or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));

create policy "task_categories_admin_all"
  on public.task_categories for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));

create policy "task_regions_admin_all"
  on public.task_regions for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));

-- 初始种子数据
insert into public.task_categories (name, color, sort_order) values
  ('民事诉讼', '#3b82f6', 1),
  ('刑事辩护', '#ef4444', 2),
  ('商事仲裁', '#8b5cf6', 3),
  ('劳动争议', '#f59e0b', 4),
  ('知识产权', '#10b981', 5),
  ('婚姻家庭', '#ec4899', 6),
  ('行政诉讼', '#6366f1', 7),
  ('法律顾问', '#14b8a6', 8),
  ('合同审查', '#fa8231', 9),
  ('其他', '#94a3b8', 99)
on conflict (name) do nothing;

insert into public.task_regions (name, sort_order) values
  ('全国', 1),
  ('北京市', 2),
  ('上海市', 3),
  ('广东省', 4),
  ('浙江省', 5),
  ('江苏省', 6),
  ('四川省', 7),
  ('湖北省', 8),
  ('湖南省', 9),
  ('山东省', 10),
  ('河南省', 11),
  ('福建省', 12),
  ('其他', 99)
on conflict (name) do nothing;
