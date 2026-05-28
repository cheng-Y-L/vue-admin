import type { LawyerCertificationStatus } from '@/types'

export const LAWYER_LICENSE_BUCKET = 'lawyer-licenses'

/** 律师证图片最大 5MB */
export const LAWYER_LICENSE_MAX_BYTES = 5 * 1024 * 1024

export const LAWYER_LICENSE_ACCEPT = 'image/jpeg,image/png,image/webp'

export const LAWYER_CERT_STATUS_LABELS: Record<LawyerCertificationStatus, string> = {
  none: '未认证',
  pending: '审核中',
  approved: '已认证',
  rejected: '已驳回',
}

/** 未通过资质认证时允许访问的路由 name */
export const LAWYER_UNVERIFIED_ROUTE_NAMES = new Set([
  'lawyer-verify-required',
  'lawyer-profile',
  'login',
])
