import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/services/data'
import { fetchSettlementRecords } from '@/services/task-settlement.service'
import type { AdminPlatformStats } from '@/types'

export async function fetchAdminPlatformStats(): Promise<AdminPlatformStats> {
  if (!isSupabaseConfigured()) {
    const users = db.getUsers()
    const tasks = db.getTasks().filter((t) => t.status !== 'draft')
    const applications = db.getTaskApplications()
    const settlements = await fetchSettlementRecords('', 'admin')
    const settled = settlements.filter((r) => r.settlementStatus === 'settled')

    return {
      userCount: users.length,
      activeUserCount: users.filter((u) => u.status === 'active').length,
      lawyerCount: users.filter((u) => u.role === 'lawyer').length,
      publisherCount: users.filter((u) => u.role === 'publisher').length,
      taskCount: tasks.length,
      pendingTaskCount: tasks.filter((t) => t.status === 'pending').length,
      inProgressTaskCount: tasks.filter(
        (t) =>
          t.status === 'in_progress' ||
          t.status === 'awaiting_completion' ||
          t.status === 'disputed',
      ).length,
      completedTaskCount: tasks.filter((t) => t.status === 'completed').length,
      closedTaskCount: tasks.filter((t) => t.status === 'closed').length,
      applicationCount: applications.length,
      pendingApplicationCount: applications.filter((a) => a.status === 'pending').length,
      settledCount: settled.length,
      settledAmount: settled.reduce((s, r) => s + (r.agreedAmount ?? 0), 0),
    }
  }

  const [
    profilesRes,
    tasksRes,
    applicationsRes,
    settlements,
  ] = await Promise.all([
    supabase.from('profiles').select('id, role, status'),
    supabase.from('tasks').select('id, status').neq('status', 'draft'),
    supabase.from('task_applications').select('id, status'),
    fetchSettlementRecords('', 'admin'),
  ])

  const profiles = profilesRes.data ?? []
  const tasks = tasksRes.data ?? []
  const applications = applicationsRes.data ?? []
  const settled = settlements.filter((r) => r.settlementStatus === 'settled')

  return {
    userCount: profiles.length,
    activeUserCount: profiles.filter((p) => p.status === 'active').length,
    lawyerCount: profiles.filter((p) => p.role === 'lawyer').length,
    publisherCount: profiles.filter((p) => p.role === 'publisher').length,
    taskCount: tasks.length,
    pendingTaskCount: tasks.filter((t) => t.status === 'pending').length,
    inProgressTaskCount: tasks.filter(
      (t) =>
        t.status === 'in_progress' ||
        t.status === 'awaiting_completion' ||
        t.status === 'disputed',
    ).length,
    completedTaskCount: tasks.filter((t) => t.status === 'completed').length,
    closedTaskCount: tasks.filter((t) => t.status === 'closed').length,
    applicationCount: applications.length,
    pendingApplicationCount: applications.filter((a) => a.status === 'pending').length,
    settledCount: settled.length,
    settledAmount: settled.reduce((s, r) => s + (r.agreedAmount ?? 0), 0),
  }
}
