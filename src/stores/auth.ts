import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/services/data'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { PERMISSION_TO_PATH } from '@/router/nav'
import {
  fetchProfileById,
  fetchSessionUser,
  signUpWithEmail,
  signOutSupabase,
  signInLocalDemo,
  logAuthSuccess,
  type SignUpParams,
} from '@/services/auth.service'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const initialized = ref(false)
  const authLoading = ref(false)

  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const useSupabase = computed(() => isSupabaseConfigured())

  function hasPermission(permission: string) {
    const user = currentUser.value
    if (!user) return false
    return user.role === 'admin' || user.permissions.includes(permission)
  }

  function setUser(user: User | null) {
    currentUser.value = user
    db.setCurrentSession(user)
  }

  async function init() {
    if (initialized.value) return

    if (isSupabaseConfigured()) {
      currentUser.value = await fetchSessionUser()
      if (currentUser.value) db.setCurrentSession(currentUser.value)

      // 异步逻辑必须 defer，否则 signInWithPassword 会死锁（authLoading 一直为 true）
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          currentUser.value = null
          db.setCurrentSession(null)
          return
        }
        if (!session?.user) return
        if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') return

        setTimeout(async () => {
          const profile = await fetchProfileById(session.user.id)
          if (profile && profile.status === 'active') {
            currentUser.value = profile
            db.setCurrentSession(profile)
          }
        }, 0)
      })
    } else {
      currentUser.value = db.getCurrentSession()
    }

    initialized.value = true
  }

  function restoreSession() {
    if (!isSupabaseConfigured()) {
      currentUser.value = db.getCurrentSession()
    }
  }

  function login(user: User) {
    setUser(user)
  }

  async function loginWithCredentials(identifier: string, password: string) {
    authLoading.value = true
    try {
      const { user, error } = await signInLocalDemo(identifier, password)
      if (error || !user) return { ok: false as const, error: error ?? '登录失败' }
      logAuthSuccess(user, isSupabaseConfigured() ? '登录系统成功 (Supabase)' : '登录系统成功')
      setUser(user)
      return { ok: true as const }
    } finally {
      authLoading.value = false
    }
  }

  async function register(params: SignUpParams) {
    authLoading.value = true
    try {
      const { user, needsEmailConfirmation, error } = await signUpWithEmail(params)
      if (error) return { ok: false as const, error, needsEmailConfirmation: false }
      if (needsEmailConfirmation) {
        return { ok: true as const, needsEmailConfirmation: true }
      }
      if (!user) return { ok: false as const, error: '注册失败', needsEmailConfirmation: false }
      logAuthSuccess(user, '新用户注册并自动分配权限角色')
      setUser(user)
      return { ok: true as const, needsEmailConfirmation: false }
    } finally {
      authLoading.value = false
    }
  }

  async function logout() {
    if (currentUser.value) {
      const u = currentUser.value
      db.addLog(
        u.username,
        u.role === 'admin' ? '管理员' : u.role === 'editor' ? '编辑' : '分析员',
        '主动退出登录退出系统',
        'Auth',
        'success',
      )
    }
    await signOutSupabase()
    setUser(null)
  }

  async function refreshFromDb() {
    if (!currentUser.value) return

    if (isSupabaseConfigured()) {
      const profile = await fetchProfileById(currentUser.value.id)
      if (profile && profile.status === 'active') {
        setUser(profile)
        return
      }
      await logout()
      return
    }

    const updated = db.getUsers().find((u) => u.id === currentUser.value!.id)
    if (updated && updated.status === 'active') {
      setUser(updated)
      return
    }
    await logout()
  }

  function getDefaultPath() {
    const user = currentUser.value
    if (!user) return '/login'
    if (hasPermission('dashboard_view')) return '/dashboard'
    const firstPath = user.permissions.map((p) => PERMISSION_TO_PATH[p]).find(Boolean)
    return firstPath ?? '/dashboard'
  }

  return {
    currentUser,
    initialized,
    authLoading,
    isAuthenticated,
    isAdmin,
    useSupabase,
    hasPermission,
    init,
    restoreSession,
    login,
    loginWithCredentials,
    register,
    logout,
    refreshFromDb,
    getDefaultPath,
  }
})
