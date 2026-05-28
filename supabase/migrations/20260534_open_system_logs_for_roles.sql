-- 为发布方与律师补全核心安全审计权限

update public.profiles
set permissions = array_append(permissions, 'system_logs_view')
where role in ('publisher', 'lawyer')
  and not ('system_logs_view' = any(permissions));
