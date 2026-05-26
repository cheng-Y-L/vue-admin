import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/services/data'
import type { User } from '@/types'
import type { Database } from '@/types/database'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'

const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': '邮箱或密码错误，请检查后重试',
  'Email not confirmed': '邮箱尚未验证，请查收验证邮件后登录',
  'User already registered': '该邮箱已被注册',
  'Password should be at least 6 characters': '密码至少需要 6 位',
  'Signup requires a valid password': '请输入有效密码',
  'Unable to validate email address: invalid format': '邮箱格式不正确',
  'Invalid API key': 'Supabase API Key 无效，请在 .env 中填写 Dashboard → API 的 anon public key',
}

export function translateAuthError(message: string): string {
  return AUTH_ERROR_MAP[message] ?? message
}

export function mapProfileToUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    username: profile.username,
    nickname: profile.nickname,
    email: profile.email,
    role: profile.role,
    permissions: profile.permissions ?? [],
    status: profile.status,
    avatar: profile.avatar ?? DEFAULT_AVATAR,
    createTime: profile.create_time.replace('T', ' ').substring(0, 19),
  }
}

export async function fetchProfileById(userId: string): Promise<User | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

  if (error || !data) return null
  return mapProfileToUser(data)
}

export async function fetchSessionUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return null

  return fetchProfileById(session.user.id)
}

export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { available: false, error: '未配置 Supabase，请检查 .env 文件' }
  }

  const { data, error } = await supabase.rpc('is_username_available', {
    check_username: username.trim(),
  })

  if (error) {
    return { available: false, error: '无法验证用户名，请确认已在 Supabase 执行 schema.sql' }
  }
  return { available: Boolean(data), error: null }
}

async function fetchProfileWithRetry(userId: string, retries = 6, delayMs = 400): Promise<User | null> {
  for (let i = 0; i < retries; i++) {
    const profile = await fetchProfileById(userId)
    if (profile) return profile
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return null
}

export interface SignUpParams {
  email: string
  password: string
  username: string
  nickname: string
  role: 'admin' | 'editor' | 'viewer'
  avatar: string
}

export async function signUpWithEmail(params: SignUpParams): Promise<{
  user: User | null
  needsEmailConfirmation: boolean
  error: string | null
}> {
  if (!isSupabaseConfigured()) {
    return { user: null, needsEmailConfirmation: false, error: '未配置 Supabase，请检查 .env 文件' }
  }

  const usernameCheck = await checkUsernameAvailable(params.username)
  if (usernameCheck.error) {
    return { user: null, needsEmailConfirmation: false, error: usernameCheck.error }
  }
  if (!usernameCheck.available) {
    return { user: null, needsEmailConfirmation: false, error: '用户名已被占用' }
  }

  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      data: {
        username: params.username.trim(),
        nickname: params.nickname.trim(),
        role: params.role,
        avatar: params.avatar,
      },
    },
  })

  if (error) {
    return { user: null, needsEmailConfirmation: false, error: translateAuthError(error.message) }
  }

  if (!data.user) {
    return { user: null, needsEmailConfirmation: false, error: '注册失败，请稍后重试' }
  }

  const needsEmailConfirmation = !data.session

  if (needsEmailConfirmation) {
    return { user: null, needsEmailConfirmation: true, error: null }
  }

  await new Promise((r) => setTimeout(r, 300))
  const profile = await fetchProfileWithRetry(data.user.id)
  return { user: profile, needsEmailConfirmation: false, error: profile ? null : '用户档案创建失败，请确认已在 Supabase 执行 schema.sql 后重试' }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: '未配置 Supabase，请检查 .env 文件' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return { user: null, error: translateAuthError(error.message) }
  }

  if (!data.user) {
    return { user: null, error: '登录失败' }
  }

  const profile = await fetchProfileWithRetry(data.user.id)
  if (!profile) {
    await supabase.auth.signOut()
    return { user: null, error: '用户档案不存在，请确认已在 Supabase 执行 schema.sql' }
  }

  if (profile.status === 'suspended') {
    await supabase.auth.signOut()
    return { user: null, error: '您的账号已被暂停使用，请联系管理员' }
  }

  return { user: profile, error: null }
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase.auth.signOut()
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: '未配置 Supabase' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/login`,
  })

  return { error: error ? translateAuthError(error.message) : null }
}

/** 使用用户名登录（Supabase：RPC 解析邮箱后走 signInWithPassword） */
export async function signInLocalDemo(
  username: string,
  password: string,
): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: '未配置 Supabase，请检查 .env 文件' }
  }

  const trimmed = username.trim()
  if (!trimmed || !password.trim()) {
    return { user: null, error: '请输入用户名和密码' }
  }

  if (trimmed.includes('@')) {
    return signInWithEmail(trimmed, password)
  }

  const { data: email, error: rpcError } = await supabase.rpc('get_login_email_by_username', {
    check_username: trimmed,
  })

  if (rpcError || !email) {
    db.addLog(trimmed, '未知', '尝试登录系统失败: 用户名不存在', 'Auth', 'failed')
    return { user: null, error: '用户名或密码错误' }
  }

  return signInWithEmail(email, password)
}

export function logAuthSuccess(user: User, action: string) {
  db.addLog(
    user.username,
    user.role === 'admin' ? '管理员' : user.role === 'editor' ? '编辑' : '分析员',
    action,
    'Auth',
    'success',
  )
}
