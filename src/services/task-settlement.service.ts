import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { mapTaskRow } from '@/services/task.service'
import { mapApplicationRow } from '@/services/task-application.service'
import { db } from '@/services/data'
import { taskStatusToSettlement } from '@/constants/settlements'
import { normalizeRole } from '@/constants/roles'
import type { UserRole } from '@/constants/roles'
import type { Task, TaskSettlementRecord } from '@/types'

interface ProfileBrief {
  id: string
  nickname: string
  username: string
}

function resolveAgreedAmount(budget: number | null, acceptedQuote: number | null): number | null {
  if (acceptedQuote !== null) return acceptedQuote
  if (budget !== null) return budget
  return null
}

function displayName(profile: ProfileBrief | null, fallback: string): string {
  if (!profile) return fallback
  return profile.nickname?.trim() || profile.username?.trim() || fallback
}

async function fetchProfileBriefs(ids: string[]): Promise<Map<string, ProfileBrief>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, ProfileBrief>()
  if (!unique.length) return map

  if (!isSupabaseConfigured()) {
    for (const id of unique) {
      const user = db.getUsers().find((u) => u.id === id)
      if (user) {
        map.set(id, { id: user.id, nickname: user.nickname, username: user.username })
      } else if (id === 'demo_publisher') {
        map.set(id, { id, nickname: '演示发布方', username: 'demo_publisher' })
      } else if (id === 'demo_lawyer') {
        map.set(id, { id, nickname: '演示律师', username: 'demo_lawyer' })
      }
    }
    return map
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, username')
    .in('id', unique)

  if (error || !data) return map
  for (const row of data) {
    map.set(row.id, {
      id: row.id,
      nickname: row.nickname ?? '',
      username: row.username ?? '',
    })
  }
  return map
}

async function fetchAcceptedQuotesByTask(taskIds: string[]): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>()
  if (!taskIds.length) return map

  if (!isSupabaseConfigured()) {
    for (const taskId of taskIds) {
      const accepted = db
        .getTaskApplications()
        .find((a) => a.taskId === taskId && a.status === 'accepted')
      map.set(taskId, accepted?.quote ?? null)
    }
    return map
  }

  const { data, error } = await supabase
    .from('task_applications')
    .select('*')
    .in('task_id', taskIds)
    .eq('status', 'accepted')

  if (error || !data) return map
  for (const row of data) {
    const app = mapApplicationRow(row)
    map.set(app.taskId, app.quote)
  }
  return map
}

function buildRecord(
  task: Task,
  direction: 'income' | 'expense',
  agreedAmount: number | null,
  publisherName: string,
  lawyerName: string | null,
): TaskSettlementRecord | null {
  const settlementStatus = taskStatusToSettlement(task.status)
  if (!settlementStatus) return null

  return {
    id: task.id,
    taskId: task.id,
    taskTitle: task.title,
    taskType: task.taskType,
    region: task.region,
    taskStatus: task.status,
    settlementStatus,
    direction,
    budget: task.budget,
    agreedAmount,
    publisherId: task.publisherId,
    publisherName,
    lawyerId: task.assignedLawyerId ?? null,
    lawyerName,
    updatedAt: task.updatedAt,
    createdAt: task.createdAt,
  }
}

function sortRecords(records: TaskSettlementRecord[]): TaskSettlementRecord[] {
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

async function mapTasksToRecords(
  tasks: Task[],
  direction: 'income' | 'expense',
): Promise<TaskSettlementRecord[]> {
  const relevant = tasks.filter((t) => t.status !== 'draft')
  const taskIds = relevant.map((t) => t.id)
  const profileIds = [
    ...relevant.map((t) => t.publisherId),
    ...relevant.map((t) => t.assignedLawyerId).filter((id): id is string => !!id),
  ]

  const [profiles, quotes] = await Promise.all([
    fetchProfileBriefs(profileIds),
    fetchAcceptedQuotesByTask(taskIds),
  ])

  const records: TaskSettlementRecord[] = []
  for (const task of relevant) {
    const publisher = profiles.get(task.publisherId) ?? null
    const lawyer = task.assignedLawyerId ? profiles.get(task.assignedLawyerId) ?? null : null
    const record = buildRecord(
      task,
      direction,
      resolveAgreedAmount(task.budget, quotes.get(task.id) ?? null),
      displayName(publisher, '未知发布方'),
      task.assignedLawyerId ? displayName(lawyer, '待分配律师') : null,
    )
    if (record) records.push(record)
  }
  return sortRecords(records)
}

export async function fetchSettlementRecords(
  userId: string,
  role: UserRole,
): Promise<TaskSettlementRecord[]> {
  const normalizedRole = normalizeRole(role)

  if (!isSupabaseConfigured()) {
    const tasks = db.getTasks()
    if (normalizedRole === 'admin') {
      return mapTasksToRecords(tasks, 'expense')
    }
    if (normalizedRole === 'publisher') {
      return mapTasksToRecords(
        tasks.filter((t) => t.publisherId === userId || t.publisherId === 'demo_publisher'),
        'expense',
      )
    }
    return mapTasksToRecords(
      tasks.filter((t) => t.assignedLawyerId === userId),
      'income',
    )
  }

  if (normalizedRole === 'admin') {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'draft')
      .order('updated_at', { ascending: false })
    if (error || !data) return []
    return mapTasksToRecords(data.map(mapTaskRow), 'expense')
  }

  if (normalizedRole === 'publisher') {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('publisher_id', userId)
      .neq('status', 'draft')
      .order('updated_at', { ascending: false })
    if (error || !data) return []
    return mapTasksToRecords(data.map(mapTaskRow), 'expense')
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_lawyer_id', userId)
    .neq('status', 'draft')
    .order('updated_at', { ascending: false })

  if (error || !data) return []
  return mapTasksToRecords(data.map(mapTaskRow), 'income')
}

export async function fetchRecentSettlements(
  userId: string,
  role: UserRole,
  limit = 5,
): Promise<TaskSettlementRecord[]> {
  const records = await fetchSettlementRecords(userId, role)
  return records.slice(0, limit)
}
