import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { LAWYER_UNVERIFIED_ROUTE_NAMES } from '@/constants/lawyer-cert'
import { lawyerNeedsVerification } from '@/utils/lawyer-cert'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/lawyer/verify-required',
      name: 'lawyer-verify-required',
      component: () => import('@/views/lawyer/LawyerVerifyRequiredView.vue'),
      meta: { requiresAuth: true, lawyerCertBypass: true },
    },
    {
      path: '/lawyer/profile',
      name: 'lawyer-profile',
      component: () => import('@/views/lawyer/LawyerProfileView.vue'),
      meta: { requiresAuth: true, lawyerCertBypass: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { permission: 'dashboard_view' },
        },
        {
          path: 'stats',
          name: 'stats',
          component: () => import('@/views/stats/StatsView.vue'),
          meta: { permission: 'data_stats_view' },
        },
        {
          path: 'user-list',
          name: 'user-list',
          component: () => import('@/views/users/UserListView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/dashboard',
          name: 'admin-dashboard',
          component: () => import('@/views/admin/AdminDataBoardView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/tasks',
          name: 'admin-tasks',
          component: () => import('@/views/admin/AdminTaskManagementView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/applications',
          name: 'admin-applications',
          component: () => import('@/views/admin/AdminApplicationRecordsView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/content',
          name: 'admin-content',
          component: () => import('@/views/admin/ContentManagementView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/users/UserManagementView.vue'),
          meta: { permission: 'user_manage' },
        },
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/orders/OrderManagementView.vue'),
          meta: { permission: 'order_manage' },
        },
        {
          path: 'orders/:id',
          name: 'order-task-detail',
          component: () => import('@/views/tasks/TaskDetailView.vue'),
          meta: { permission: 'order_manage' },
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('@/views/tasks/TaskManagementView.vue'),
          meta: { permission: 'task_manage' },
        },
        {
          path: 'task-hall',
          name: 'task-hall',
          component: () => import('@/views/tasks/TaskHallView.vue'),
          meta: { permission: 'task_browse' },
        },
        {
          path: 'task-hall/:id',
          name: 'task-detail',
          component: () => import('@/views/tasks/TaskDetailView.vue'),
          meta: { permission: 'task_browse' },
        },
        {
          path: 'my-tasks',
          name: 'my-tasks',
          component: () => import('@/views/tasks/MyTasksView.vue'),
          meta: { permission: 'task_browse' },
        },
        {
          path: 'my-tasks/:id',
          name: 'my-task-detail',
          component: () => import('@/views/tasks/TaskDetailView.vue'),
          meta: { permission: 'task_browse' },
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/logs/SystemLogsView.vue'),
          meta: { permission: 'system_logs_view' },
        },
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('@/views/error/ForbiddenView.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) await auth.init()

  if (to.meta.guest) {
    if (auth.isAuthenticated) return auth.getDefaultPath()
    return true
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const user = auth.currentUser
  if (user && lawyerNeedsVerification(user)) {
    const routeName = to.name as string | undefined
    const isBypass = to.meta.lawyerCertBypass || (routeName && LAWYER_UNVERIFIED_ROUTE_NAMES.has(routeName))
    if (!isBypass) {
      return { name: 'lawyer-verify-required' }
    }
  }

  if (
    user &&
    user.role === 'lawyer' &&
    user.certificationStatus === 'approved' &&
    (to.name === 'lawyer-verify-required' || to.name === 'lawyer-profile')
  ) {
    return auth.getDefaultPath()
  }

  if (to.meta.requiresAdmin && user?.role !== 'admin') {
    return { name: 'forbidden', query: { permission: '超级管理员' } }
  }

  const permission = to.meta.permission as string | undefined
  if (permission && !auth.hasPermission(permission)) {
    return { name: 'forbidden', query: { permission } }
  }

  return true
})

export default router
