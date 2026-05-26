import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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

  const permission = to.meta.permission as string | undefined
  if (permission && !auth.hasPermission(permission)) {
    return { name: 'forbidden', query: { permission } }
  }

  return true
})

export default router
