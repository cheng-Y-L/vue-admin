import {
  LayoutDashboard,
  BarChart3,
  Users,
  ShoppingBag,
  Terminal,
} from '@lucide/vue'
import type { LucideIcon } from '@lucide/vue'

export interface NavItem {
  permission: string
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { permission: 'dashboard_view', path: '/dashboard', label: '驾驶舱首页', icon: LayoutDashboard },
  { permission: 'data_stats_view', path: '/stats', label: '数据多维统计', icon: BarChart3 },
  { permission: 'user_manage', path: '/users', label: '系统权限配置', icon: Users },
  { permission: 'order_manage', path: '/orders', label: '收单履约管理', icon: ShoppingBag },
  { permission: 'system_logs_view', path: '/logs', label: '核心安全审计', icon: Terminal },
]

export const PERMISSION_TO_PATH: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.permission, item.path]),
)

/** Dashboard 快捷跳转用的旧 tabId → 路由路径 */
export const LEGACY_TAB_TO_PATH: Record<string, string> = {
  dashboard_view: '/dashboard',
  data_stats_view: '/stats',
  user_manage: '/users',
  order_manage: '/orders',
  system_logs_view: '/logs',
}
