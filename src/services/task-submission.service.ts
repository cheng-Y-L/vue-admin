import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { mapTaskRow, updateTaskStatus } from '@/services/task.service'
import { db } from '@/services/data'
import { formatLocalDateTime } from '@/utils/datetime'
import type { Database } from '@/types/database'
import type { Task, TaskSubmission, TaskSubmissionType } from '@/types'

type SubmissionRow = Database['public']['Tables']['task_submissions']['Row']
type SubmissionInsert = Database['public']['Tables']['task_submissions']['Insert']

export interface SubmitTaskPayload {
  title: string
  content: string
  attachmentUrls: string[]
  submissionType: TaskSubmissionType
}

export function mapSubmissionRow(row: SubmissionRow): TaskSubmission {
  return {
    id: row.id,
    taskId: row.task_id,
    lawyerId: row.lawyer_id,
    title: row.title,
    content: row.content,
    attachmentUrls: row.attachment_urls ?? [],
    submissionType: row.submission_type,
    createdAt: row.created_at,
  }
}

export function validateSubmissionPayload(payload: SubmitTaskPayload): string | null {
  if (!payload.title.trim()) return '请填写提交标题'
  if (!payload.content.trim()) return '请填写报告内容'
  if (payload.content.trim().length < 10) return '报告内容至少 10 个字'
  return null
}

export async function fetchTaskSubmissions(taskId: string): Promise<TaskSubmission[]> {
  if (!isSupabaseConfigured()) {
    return db
      .getTaskSubmissions()
      .filter((s) => s.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const { data, error } = await supabase
    .from('task_submissions')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapSubmissionRow)
}

export async function submitTaskProgress(
  taskId: string,
  lawyerId: string,
  payload: SubmitTaskPayload,
): Promise<{ submission: TaskSubmission | null; error: string | null }> {
  const validationError = validateSubmissionPayload(payload)
  if (validationError) return { submission: null, error: validationError }

  const task = await fetchAssignedTask(taskId, lawyerId)
  if (!task) return { submission: null, error: '任务不存在或您不是承接律师' }
  if (task.status !== 'in_progress') {
    return { submission: null, error: '仅进行中的任务可提交过程材料' }
  }

  if (!isSupabaseConfigured()) {
    const now = formatLocalDateTime()
    const submission: TaskSubmission = {
      id: `sub_${Math.random().toString(36).substring(2, 9)}`,
      taskId,
      lawyerId,
      title: payload.title.trim(),
      content: payload.content.trim(),
      attachmentUrls: payload.attachmentUrls,
      submissionType: payload.submissionType,
      createdAt: now,
    }
    const list = db.getTaskSubmissions()
    list.unshift(submission)
    db.saveTaskSubmissions(list)

    if (payload.submissionType === 'completion') {
      const statusResult = await updateTaskStatus(taskId, 'awaiting_completion', { lawyerId })
      if (!statusResult.ok) return { submission: null, error: statusResult.error }
    }

    return { submission, error: null }
  }

  const insert: SubmissionInsert = {
    task_id: taskId,
    lawyer_id: lawyerId,
    title: payload.title.trim(),
    content: payload.content.trim(),
    attachment_urls: payload.attachmentUrls,
    submission_type: payload.submissionType,
  }

  const { data, error } = await supabase.from('task_submissions').insert(insert).select('*').single()
  if (error || !data) return { submission: null, error: error?.message ?? '提交失败' }

  if (payload.submissionType === 'completion') {
    const statusResult = await updateTaskStatus(taskId, 'awaiting_completion', { lawyerId })
    if (!statusResult.ok) return { submission: null, error: statusResult.error }
  }

  return { submission: mapSubmissionRow(data), error: null }
}

async function fetchAssignedTask(taskId: string, lawyerId: string): Promise<Task | null> {
  if (!isSupabaseConfigured()) {
    const task = db.getTasks().find((t) => t.id === taskId) ?? null
    if (!task || task.assignedLawyerId !== lawyerId) return null
    return task
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('assigned_lawyer_id', lawyerId)
    .maybeSingle()

  if (error || !data) return null
  return mapTaskRow(data)
}

export async function fetchAwaitingCompletionCounts(taskIds: string[]): Promise<Record<string, number>> {
  if (!taskIds.length) return {}

  if (!isSupabaseConfigured()) {
    const counts: Record<string, number> = {}
    for (const task of db.getTasks()) {
      if (taskIds.includes(task.id) && task.status === 'awaiting_completion') {
        counts[task.id] = 1
      }
    }
    return counts
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .in('id', taskIds)
    .eq('status', 'awaiting_completion')

  if (error || !data) return {}
  const counts: Record<string, number> = {}
  for (const row of data) counts[row.id] = 1
  return counts
}

export async function fetchSubmissionCountsByTask(taskIds: string[]): Promise<Record<string, number>> {
  if (!taskIds.length) return {}

  if (!isSupabaseConfigured()) {
    const counts: Record<string, number> = {}
    for (const sub of db.getTaskSubmissions()) {
      if (taskIds.includes(sub.taskId)) {
        counts[sub.taskId] = (counts[sub.taskId] ?? 0) + 1
      }
    }
    return counts
  }

  const { data, error } = await supabase.from('task_submissions').select('task_id').in('task_id', taskIds)

  if (error || !data) return {}
  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.task_id] = (counts[row.task_id] ?? 0) + 1
  }
  return counts
}
