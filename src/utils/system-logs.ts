import { normalizeRole } from '@/constants/roles'
import type { SystemLog, User } from '@/types'

/** admin 查看全量；其他角色仅查看本人 operator 匹配的日志 */
export function filterLogsForUser(logs: SystemLog[], user: Pick<User, 'role' | 'username'>): SystemLog[] {
  if (normalizeRole(user.role) === 'admin') return logs
  const username = user.username.trim().toLowerCase()
  return logs.filter((l) => l.operator.trim().toLowerCase() === username)
}
