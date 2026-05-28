import {
  LayoutDashboard,
  BarChart3,
  Users,
  UserRoundSearch,
  ShoppingBag,
  ClipboardList,
  Terminal,
  Briefcase,
  FolderOpen,
  PieChart,
  FileText,
  Tags,
} from '@lucide/vue'
import type { LucideIcon } from '@lucide/vue'

export interface NavItem {
  permission?: string
  /** 仅 role=admin 可见且可访问 */
  adminOnly?: boolean
  /** 路径前缀匹配时也高亮（用于详情页等子路由） */
  matchPrefix?: boolean
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { permission: 'dashboard_view', path: '/dashboard', label: '驾驶舱首页', icon: LayoutDashboard },
  { permission: 'data_stats_view', path: '/stats', label: '数据多维统计', icon: BarChart3 },
  { adminOnly: true, path: '/admin/dashboard', label: '数据看板', icon: PieChart },
  { adminOnly: true, path: '/user-list', label: '用户列表管理', icon: UserRoundSearch },
  { adminOnly: true, path: '/admin/tasks', label: '任务管理', icon: ClipboardList },
  { adminOnly: true, path: '/admin/applications', label: '申请记录', icon: FileText },
  { adminOnly: true, path: '/admin/content', label: '内容管理', icon: Tags },
  { permission: 'user_manage', path: '/users', label: '系统权限配置', icon: Users },
  { permission: 'order_manage', path: '/orders', label: '收支履约管理', icon: ShoppingBag, matchPrefix: true },
  { permission: 'task_manage', path: '/tasks', label: '任务发布管理', icon: ClipboardList },
  { permission: 'task_browse', path: '/task-hall', label: '任务大厅', icon: Briefcase, matchPrefix: true },
  { permission: 'task_browse', path: '/my-tasks', label: '我的任务', icon: FolderOpen, matchPrefix: true },
  { permission: 'system_logs_view', path: '/logs', label: '核心安全审计', icon: Terminal },
]

export const PERMISSION_TO_PATH: Record<string, string> = {}
for (const item of NAV_ITEMS) {
  if (item.permission && !PERMISSION_TO_PATH[item.permission]) {
    PERMISSION_TO_PATH[item.permission] = item.path
  }
}

/** Dashboard 快捷跳转用的旧 tabId → 路由路径 */
export const LEGACY_TAB_TO_PATH: Record<string, string> = {
  dashboard_view: '/dashboard',
  data_stats_view: '/stats',
  user_manage: '/users',
  order_manage: '/orders',
  task_manage: '/tasks',
  task_browse: '/task-hall',
  system_logs_view: '/logs',
}
