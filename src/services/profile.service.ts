import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { mapProfileToUser } from '@/services/auth.service'
import type { User } from '@/types'

export async function fetchAllProfiles(): Promise<User[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase.from('profiles').select('*').order('create_time', { ascending: false })

  if (error || !data) return []
  return data.map(mapProfileToUser)
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<User, 'role' | 'permissions' | 'status' | 'nickname' | 'avatar'>>,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { ok: false, error: '未配置 Supabase' }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)

  return { ok: !error, error: error?.message ?? null }
}

export async function deleteProfile(userId: string): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { ok: false, error: '未配置 Supabase' }

  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  return { ok: !error, error: error?.message ?? null }
}
