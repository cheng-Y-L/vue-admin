export const USER_ROLES = ['admin', 'publisher', 'lawyer'] as const

export type UserRole = (typeof USER_ROLES)[number]

/** @deprecated 仅用于本地/库内旧数据迁移 */
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  editor: 'publisher',
  viewer: 'lawyer',
}

export function normalizeRole(role: string): UserRole {
  if (role === 'admin' || role === 'publisher' || role === 'lawyer') return role
  return LEGACY_ROLE_MAP[role] ?? 'lawyer'
}

export function roleLabel(role: string): string {
  switch (normalizeRole(role)) {
    case 'admin':
      return '管理员'
    case 'publisher':
      return '发布侧'
    case 'lawyer':
      return '律师'
    default:
      return role
  }
}

export function isPublisherRole(role: string): boolean {
  return normalizeRole(role) === 'publisher'
}

/** 角色自带的隐式权限（无需在 profiles.permissions 中单独配置） */
export const ROLE_IMPLICIT_PERMISSIONS: Record<UserRole, readonly string[]> = {
  admin: [],
  publisher: ['task_manage', 'dashboard_view', 'data_stats_view', 'system_logs_view'],
  lawyer: ['task_browse', 'dashboard_view', 'data_stats_view', 'system_logs_view'],
}

export function effectivePermissions(role: UserRole, permissions: string[]): string[] {
  const implicit = ROLE_IMPLICIT_PERMISSIONS[role] ?? []
  return [...new Set([...permissions, ...implicit])]
}

export function roleHasPermission(role: UserRole, permissions: string[], permission: string): boolean {
  if (role === 'admin') return true
  return effectivePermissions(role, permissions).includes(permission)
}
