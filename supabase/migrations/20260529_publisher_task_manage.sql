-- 为已有发布侧账号补全 task_manage 权限
update public.profiles
set permissions = array_append(permissions, 'task_manage')
where role = 'publisher'
  and not ('task_manage' = any(permissions));
