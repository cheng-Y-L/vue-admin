import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/services/data'
import { normalizeRole, roleLabel, effectivePermissions } from '@/constants/roles'
import { normalizeCertificationStatus } from '@/utils/lawyer-cert'
import { parseLoginIdentifier, resolveAuthEmail } from '@/utils/account'
import type { User, UserRole } from '@/types'
import type { Database } from '@/types/database'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'

const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': '用户名/手机号/邮箱或密码错误，请检查后重试',
  'Email not confirmed': '邮箱尚未验证，请查收验证邮件后登录',
  'User already registered': '该手机号或邮箱已被注册',
  'Password should be at least 6 characters': '密码至少需要 6 位',
  'Signup requires a valid password': '请输入有效密码',
  'Unable to validate email address: invalid format': '邮箱格式不正确',
  'Invalid API key': 'Supabase API Key 无效，请在 .env 中填写 Dashboard → API 的 anon public key',
  'Database error saving new user':
    '注册时写入用户档案失败，请在 Supabase SQL Editor 执行 supabase/migrations/20260527_fix_signup.sql',
}

function isInvalidAuthEmailMessage(message: string): boolean {
  return /email address.*is invalid/i.test(message)
}

export function translateAuthError(message: string): string {
  if (isInvalidAuthEmailMessage(message)) {
    return '手机号注册用的占位邮箱未通过 Supabase 校验，请更新到最新前端代码后重试；生产环境可在 .env 配置 VITE_PHONE_AUTH_EMAIL_DOMAIN 为你的域名'
  }
  return AUTH_ERROR_MAP[message] ?? message
}

export function mapProfileToUser(profile: ProfileRow): User {
  const role = normalizeRole(profile.role)
  const certificationStatus =
    role === 'lawyer' ? normalizeCertificationStatus(profile.certification_status) : 'approved'

  return {
    id: profile.id,
    username: profile.username,
    nickname: profile.nickname,
    email: profile.email,
    phone: profile.phone,
    role,
    permissions: effectivePermissions(role, profile.permissions ?? []),
    status: profile.status,
    avatar: profile.avatar ?? DEFAULT_AVATAR,
    createTime: profile.create_time.replace('T', ' ').substring(0, 19),
    certificationStatus,
    realName: profile.real_name,
    idCard: profile.id_card,
    lawFirm: profile.law_firm,
    licenseNumber: profile.license_number,
    licenseImageUrl: profile.license_image_url,
    practiceArea: profile.practice_area,
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

  const profile = await fetchProfileById(session.user.id)
  if (!profile || profile.status !== 'active') {
    await supabase.auth.signOut()
    return null
  }
  return profile
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

export async function checkPhoneAvailable(phone: string): Promise<{ available: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { available: false, error: '未配置 Supabase，请检查 .env 文件' }
  }

  const { data, error } = await supabase.rpc('is_phone_available', {
    check_phone: phone,
  })

  if (error) {
    return { available: false, error: '无法验证手机号，请确认已在 Supabase 执行最新迁移脚本' }
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
  email?: string
  phone?: string
  password: string
  username: string
  nickname: string
  role: UserRole
  avatar: string
}

export async function signUpWithAccount(params: SignUpParams): Promise<{
  user: User | null
  needsEmailConfirmation: boolean
  error: string | null
}> {
  if (!isSupabaseConfigured()) {
    return { user: null, needsEmailConfirmation: false, error: '未配置 Supabase，请检查 .env 文件' }
  }

  const resolved = resolveAuthEmail(params.email, params.phone)
  if ('error' in resolved) {
    return { user: null, needsEmailConfirmation: false, error: resolved.error }
  }

  const usernameCheck = await checkUsernameAvailable(params.username)
  if (usernameCheck.error) {
    return { user: null, needsEmailConfirmation: false, error: usernameCheck.error }
  }
  if (!usernameCheck.available) {
    return { user: null, needsEmailConfirmation: false, error: '用户名已被占用' }
  }

  if (resolved.phone) {
    const phoneCheck = await checkPhoneAvailable(resolved.phone)
    if (phoneCheck.error) {
      return { user: null, needsEmailConfirmation: false, error: phoneCheck.error }
    }
    if (!phoneCheck.available) {
      return { user: null, needsEmailConfirmation: false, error: '手机号已被注册' }
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email: resolved.authEmail,
    password: params.password,
    options: {
      data: {
        username: params.username.trim(),
        nickname: params.nickname.trim(),
        role: params.role,
        avatar: params.avatar,
        phone: resolved.phone ?? '',
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

/** @deprecated 使用 signUpWithAccount */
export const signUpWithEmail = signUpWithAccount

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
    return { user: null, error: '您的账号已被禁用，请联系管理员' }
  }

  return { user: profile, error: null }
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase.auth.signOut()
}

export async function resetPassword(account: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: '未配置 Supabase' }
  }

  const authEmail = await resolveAuthEmailForLogin(account)
  if (!authEmail) {
    return { error: '未找到该手机号或邮箱对应的账号' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
    redirectTo: `${window.location.origin}/login`,
  })

  return { error: error ? translateAuthError(error.message) : null }
}

async function resolveAuthEmailForLogin(account: string): Promise<string | null> {
  const parsed = parseLoginIdentifier(account)
  if (!parsed) return null

  if (parsed.kind === 'username') {
    const { data, error } = await supabase.rpc('get_login_email_by_username', {
      check_username: parsed.value,
    })
    if (!error && data) return data
    if (error) {
      console.warn('[auth] get_login_email_by_username failed:', error.message)
    }
    const fallback = await supabase.rpc('get_login_email_by_account', { account: parsed.value })
    if (!fallback.error && fallback.data) return fallback.data
    return null
  }

  const lookupKey = parsed.value
  const { data, error } = await supabase.rpc('get_login_email_by_account', { account: lookupKey })
  if (error) {
    console.warn('[auth] get_login_email_by_account failed:', error.message)
    return parsed.kind === 'email' ? parsed.value : null
  }
  if (data) return data
  if (parsed.kind === 'email') return parsed.value
  return null
}

/** 使用用户名、手机号或邮箱登录 */
export async function signInWithAccount(
  account: string,
  password: string,
): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: '未配置 Supabase，请检查 .env 文件' }
  }

  const trimmed = account.trim()
  if (!trimmed || !password.trim()) {
    return { user: null, error: '请输入用户名和密码' }
  }

  if (!parseLoginIdentifier(trimmed)) {
    return { user: null, error: '用户名至少 3 个字符，或使用有效的手机号/邮箱' }
  }

  const authEmail = await resolveAuthEmailForLogin(trimmed)
  if (!authEmail) {
    db.addLog(trimmed, '未知', '尝试登录系统失败: 账号不存在', 'Auth', 'failed')
    return { user: null, error: '用户名或密码错误' }
  }

  return signInWithEmail(authEmail, password)
}

/** @deprecated 使用 signInWithAccount */
export const signInLocalDemo = signInWithAccount

export function logAuthSuccess(user: User, action: string) {
  db.addLog(
    user.username,
    roleLabel(user.role),
    action,
    'Auth',
    'success',
  )
}
