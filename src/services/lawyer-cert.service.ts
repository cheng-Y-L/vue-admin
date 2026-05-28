import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { mapProfileToUser } from '@/services/auth.service'
import {
  LAWYER_LICENSE_ACCEPT,
  LAWYER_LICENSE_BUCKET,
  LAWYER_LICENSE_MAX_BYTES,
} from '@/constants/lawyer-cert'
import type { User } from '@/types'

export interface LawyerProfilePayload {
  realName: string
  idCard: string
  lawFirm: string
  licenseNumber: string
  practiceArea?: string
  licenseImageUrl: string
}

const ID_CARD_RE = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/

export function validateLawyerLicenseFile(file: File): string | null {
  const allowed = LAWYER_LICENSE_ACCEPT.split(',').map((t) => t.trim())
  if (!allowed.includes(file.type)) {
    return '请上传 JPG、PNG 或 WebP 格式的律师证图片'
  }
  if (file.size > LAWYER_LICENSE_MAX_BYTES) {
    return '律师证图片不能超过 5MB'
  }
  return null
}

export function validateLawyerProfilePayload(payload: LawyerProfilePayload): string | null {
  if (!payload.realName.trim()) return '请填写真实姓名'
  if (!ID_CARD_RE.test(payload.idCard.trim())) return '请输入有效的 18 位身份证号码'
  if (!payload.lawFirm.trim()) return '请填写执业机构'
  if (!payload.licenseNumber.trim()) return '请填写律师执业证号'
  if (!payload.licenseImageUrl.trim()) return '请上传律师执业证照片'
  return null
}

/** 将 profiles 中存的 path 或历史 URL 转为 Storage 对象路径 */
export function resolveLicenseStoragePath(stored: string): string {
  const trimmed = stored.trim()
  if (!trimmed.includes('://')) return trimmed
  const marker = `/storage/v1/object/${LAWYER_LICENSE_BUCKET}/`
  const idx = trimmed.indexOf(marker)
  if (idx >= 0) return decodeURIComponent(trimmed.slice(idx + marker.length).split('?')[0] ?? '')
  return trimmed
}

export async function getLawyerLicenseSignedUrl(
  storedPathOrUrl: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !storedPathOrUrl.trim()) return null

  const path = resolveLicenseStoragePath(storedPathOrUrl)
  const { data, error } = await supabase.storage
    .from(LAWYER_LICENSE_BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function uploadLawyerLicenseImage(
  userId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const fileError = validateLawyerLicenseFile(file)
  if (fileError) return { path: null, error: fileError }

  if (!isSupabaseConfigured()) {
    return { path: null, error: '未配置 Supabase' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const objectPath = `${userId}/license-${Date.now()}.${safeExt}`

  const { error } = await supabase.storage.from(LAWYER_LICENSE_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) {
    return { path: null, error: error.message || '律师证图片上传失败' }
  }

  return { path: objectPath, error: null }
}

export async function submitLawyerCertification(
  userId: string,
  payload: LawyerProfilePayload,
): Promise<{ user: User | null; error: string | null }> {
  const validationError = validateLawyerProfilePayload(payload)
  if (validationError) return { user: null, error: validationError }

  if (!isSupabaseConfigured()) {
    return { user: null, error: '未配置 Supabase' }
  }

  const licensePath = resolveLicenseStoragePath(payload.licenseImageUrl)

  const { data, error } = await supabase
    .from('profiles')
    .update({
      real_name: payload.realName.trim(),
      id_card: payload.idCard.trim().toUpperCase(),
      law_firm: payload.lawFirm.trim(),
      license_number: payload.licenseNumber.trim(),
      license_image_url: licensePath,
      practice_area: payload.practiceArea?.trim() || null,
      certification_status: 'pending',
    })
    .eq('id', userId)
    .select('*')
    .single()

  if (error || !data) {
    return { user: null, error: error?.message ?? '提交失败，请稍后重试' }
  }

  return { user: mapProfileToUser(data), error: null }
}

/** 删除用户目录下律师证 Storage 文件（删除账号前调用，须 Storage API） */
export async function removeLawyerLicenseFilesForUser(
  userId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { ok: true, error: null }

  const { data: files, error: listError } = await supabase.storage.from(LAWYER_LICENSE_BUCKET).list(userId)
  if (listError) {
    return { ok: false, error: listError.message || '无法列出律师证文件' }
  }

  const paths = (files ?? [])
    .filter((f) => f.name && f.id)
    .map((f) => `${userId}/${f.name}`)

  if (!paths.length) return { ok: true, error: null }

  const { error: removeError } = await supabase.storage.from(LAWYER_LICENSE_BUCKET).remove(paths)
  if (removeError) {
    return { ok: false, error: removeError.message || '删除律师证文件失败' }
  }

  return { ok: true, error: null }
}
