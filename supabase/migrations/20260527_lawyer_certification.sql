-- 律师资质认证与个人资料字段

alter table public.profiles
  add column if not exists certification_status text not null default 'none'
    check (certification_status in ('none', 'pending', 'approved', 'rejected'));

alter table public.profiles add column if not exists real_name text;
alter table public.profiles add column if not exists id_card text;
alter table public.profiles add column if not exists law_firm text;
alter table public.profiles add column if not exists license_number text;
alter table public.profiles add column if not exists practice_area text;
