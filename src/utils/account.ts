/** 中国大陆手机号：11 位，1 开头 */
const CN_MOBILE = /^1[3-9]\d{9}$/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 仅手机号注册时，用于 Supabase Auth 的占位邮箱域名。
 * Supabase 会校验邮箱域名（DNS MX / 白名单），`.internal` 等域名会被拒绝。
 * 默认使用 outlook.com（在 Supabase 内置白名单中，仅作占位，不会真的收信）。
 * 生产环境建议在 .env 配置自有域名：VITE_PHONE_AUTH_EMAIL_DOMAIN=auth.yourdomain.com
 */
export const PHONE_AUTH_EMAIL_DOMAIN =
  import.meta.env.VITE_PHONE_AUTH_EMAIL_DOMAIN?.trim() || 'outlook.com'

/** @deprecated 旧版占位域名，登录解析仍可能遇到历史账号 */
export const LEGACY_PHONE_AUTH_EMAIL_DOMAIN = 'accounts.internal'

export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('86')) {
    digits = digits.slice(2)
  }
  if (digits.length === 11 && CN_MOBILE.test(digits)) return digits
  return null
}

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim())
}

export function isPhoneInput(input: string): boolean {
  return normalizePhone(input) !== null
}

export function isEmailInput(input: string): boolean {
  return input.includes('@')
}

export function phoneToAuthEmail(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error('手机号格式不正确')
  return `p${normalized}@${PHONE_AUTH_EMAIL_DOMAIN}`
}

/** 将手机号转为所有历史占位邮箱格式（用于登录时解析） */
export function phoneToAuthEmailCandidates(phone: string): string[] {
  const normalized = normalizePhone(phone)
  if (!normalized) return []
  const current = phoneToAuthEmail(normalized)
  const legacy = `p.${normalized}@${LEGACY_PHONE_AUTH_EMAIL_DOMAIN}`
  return current === legacy ? [current] : [current, legacy]
}

export type LoginIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'username'; value: string }

/** 登录/找回密码：用户名、手机号或邮箱 */
export function parseLoginIdentifier(input: string): LoginIdentifier | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (isEmailInput(trimmed)) {
    if (!isValidEmail(trimmed)) return null
    return { kind: 'email', value: trimmed.toLowerCase() }
  }
  const phone = normalizePhone(trimmed)
  if (phone) return { kind: 'phone', value: phone }
  if (trimmed.length >= 3) return { kind: 'username', value: trimmed }
  return null
}

/** @deprecated 使用 parseLoginIdentifier */
export const parseAccountIdentifier = parseLoginIdentifier

export function resolveAuthEmail(email?: string, phone?: string): { authEmail: string; displayEmail: string; phone: string | null } | { error: string } {
  const trimmedEmail = email?.trim() ?? ''
  const trimmedPhone = phone?.trim() ?? ''

  if (!trimmedEmail && !trimmedPhone) {
    return { error: '请填写手机号或邮箱（至少一项）' }
  }

  if (trimmedEmail && !isValidEmail(trimmedEmail)) {
    return { error: '邮箱格式不正确' }
  }

  let normalizedPhone: string | null = null
  if (trimmedPhone) {
    normalizedPhone = normalizePhone(trimmedPhone)
    if (!normalizedPhone) return { error: '手机号格式不正确，请输入 11 位中国大陆手机号' }
  }

  if (trimmedEmail && normalizedPhone) {
    return {
      authEmail: trimmedEmail.toLowerCase(),
      displayEmail: trimmedEmail.toLowerCase(),
      phone: normalizedPhone,
    }
  }

  if (trimmedEmail) {
    return {
      authEmail: trimmedEmail.toLowerCase(),
      displayEmail: trimmedEmail.toLowerCase(),
      phone: null,
    }
  }

  const authEmail = phoneToAuthEmail(normalizedPhone!)
  return {
    authEmail,
    displayEmail: normalizedPhone!,
    phone: normalizedPhone,
  }
}
