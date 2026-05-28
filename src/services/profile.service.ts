import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { mapProfileToUser } from '@/services/auth.service'
import { removeLawyerLicenseFilesForUser } from '@/services/lawyer-cert.service'
import type { Database } from '@/types/database'
import type { User } from '@/types'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export async function fetchAllProfiles(): Promise<User[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase.from('profiles').select('*').order('create_time', { ascending: false })

  if (error || !data) return []
  return data.map(mapProfileToUser)
}

export async function updateProfile(
  userId: string,
  patch: Partial<
    Pick<User, 'role' | 'permissions' | 'status' | 'nickname' | 'avatar' | 'certificationStatus'>
  >,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { ok: false, error: '未配置 Supabase' }

  const dbPatch: ProfileUpdate = {
    role: patch.role,
    permissions: patch.permissions,
    status: patch.status,
    nickname: patch.nickname,
    avatar: patch.avatar,
    certification_status: patch.certificationStatus,
  }

  const { error } = await supabase.from('profiles').update(dbPatch).eq('id', userId)

  return { ok: !error, error: error?.message ?? null }
}

const DELETE_USER_ERROR_MAP: Record<string, string> = {
  '无权删除用户': '无权删除用户',
  '不能删除自己的账号': '不能删除自己的账号',
  '用户不存在': '用户不存在',
  '无效的用户 ID': '无效的用户 ID',
}

function translateDeleteUserError(message: string): string {
  for (const [key, label] of Object.entries(DELETE_USER_ERROR_MAP)) {
    if (message.includes(key)) return label
  }
  if (/permission denied|not allowed/i.test(message)) {
    return '删除失败：请确认已在 Supabase 执行 supabase/migrations/20260528_admin_delete_user.sql'
  }
  return message
}

/** 删除用户档案及对应 Supabase Auth 登录账号 */
export async function deleteProfile(userId: string): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { ok: false, error: '未配置 Supabase' }

  const storageResult = await removeLawyerLicenseFilesForUser(userId)
  if (!storageResult.ok) {
    return { ok: false, error: storageResult.error ?? '删除律师证文件失败' }
  }

  const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
  return { ok: !error, error: error ? translateDeleteUserError(error.message) : null }
}

export async function reviewLawyerCertification(
  userId: string,
  status: 'approved' | 'rejected',
): Promise<{ ok: boolean; error: string | null }> {
  return updateProfile(userId, { certificationStatus: status })
}
