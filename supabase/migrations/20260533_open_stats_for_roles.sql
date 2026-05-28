-- 为发布方与律师补全驾驶舱、多维统计权限（与 ROLE_IMPLICIT_PERMISSIONS 一致，便于 DB 查询与审计）

update public.profiles
set permissions = array_append(permissions, 'dashboard_view')
where role in ('publisher', 'lawyer')
  and not ('dashboard_view' = any(permissions));

update public.profiles
set permissions = array_append(permissions, 'data_stats_view')
where role in ('publisher', 'lawyer')
  and not ('data_stats_view' = any(permissions));
