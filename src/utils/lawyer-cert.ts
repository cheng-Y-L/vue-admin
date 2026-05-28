import type { User, LawyerCertificationStatus } from '@/types'

export function isLawyerCertified(user: User): boolean {
  return user.role !== 'lawyer' || user.certificationStatus === 'approved'
}

export function isLawyerPendingCertification(user: User): boolean {
  return user.role === 'lawyer' && user.certificationStatus === 'pending'
}

export function lawyerNeedsVerification(user: User): boolean {
  return user.role === 'lawyer' && !isLawyerCertified(user)
}

export function isLawyerProfileComplete(user: User): boolean {
  return Boolean(
    user.realName?.trim() &&
      user.idCard?.trim() &&
      user.lawFirm?.trim() &&
      user.licenseNumber?.trim() &&
      user.licenseImageUrl?.trim(),
  )
}

export function normalizeCertificationStatus(value: string | null | undefined): LawyerCertificationStatus {
  if (value === 'pending' || value === 'approved' || value === 'rejected') return value
  return 'none'
}

/** 列表展示用：隐藏身份证号中间段 */
export function maskIdCard(idCard: string | null | undefined): string {
  if (!idCard?.trim()) return '—'
  const s = idCard.trim()
  if (s.length <= 8) return s
  return `${s.slice(0, 4)}${'*'.repeat(Math.min(s.length - 8, 10))}${s.slice(-4)}`
}
