import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/services/data'
import { formatLocalDateTime } from '@/utils/datetime'
import {
  TASK_ATTACHMENT_ACCEPT,
  TASK_ATTACHMENT_BUCKET,
  TASK_ATTACHMENT_MAX_BYTES,
  TASK_STATUS_TRANSITIONS,
} from '@/constants/tasks'
import type { Database } from '@/types/database'
import type { Task, TaskStatus } from '@/types'

type TaskRow = Database['public']['Tables']['tasks']['Row']
type TaskInsert = Database['public']['Tables']['tasks']['Insert']
type TaskUpdate = Database['public']['Tables']['tasks']['Update']

export interface TaskFormPayload {
  title: string
  taskType: string
  region: string
  description: string
  budget: number | null
  deadline: string | null
  attachmentUrls: string[]
}

export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    publisherId: row.publisher_id,
    title: row.title,
    taskType: row.task_type,
    region: row.region,
    description: row.description,
    budget: row.budget !== null ? Number(row.budget) : null,
    deadline: row.deadline,
    attachmentUrls: row.attachment_urls ?? [],
    status: row.status,
    assignedLawyerId: row.assigned_lawyer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDbPayload(
  payload: TaskFormPayload,
): Pick<TaskInsert, 'title' | 'task_type' | 'region' | 'description' | 'budget' | 'deadline' | 'attachment_urls'> {
  return {
    title: payload.title.trim(),
    task_type: payload.taskType,
    region: payload.region,
    description: payload.description.trim(),
    budget: payload.budget,
    deadline: payload.deadline,
    attachment_urls: payload.attachmentUrls,
  }
}

export function validateTaskPayload(payload: TaskFormPayload, publish: boolean): string | null {
  if (!payload.title.trim()) return '请填写任务标题'
  if (!payload.taskType) return '请选择任务类型'
  if (!payload.region) return '请选择地域'
  if (publish && !payload.description.trim()) return '发布任务需填写详细描述'
  if (payload.budget !== null && (isNaN(payload.budget) || payload.budget < 0)) {
    return '请输入有效的预算金额'
  }
  if (publish && payload.deadline) {
    const deadline = new Date(payload.deadline)
    if (deadline.getTime() < Date.now()) return '截止日期不能早于当前时间'
  }
  return null
}

export function validateTaskAttachmentFile(file: File): string | null {
  const allowed = TASK_ATTACHMENT_ACCEPT.split(',').map((t) => t.trim())
  if (!allowed.includes(file.type)) {
    return '请上传 PDF、Word 或图片格式的附件'
  }
  if (file.size > TASK_ATTACHMENT_MAX_BYTES) {
    return '附件不能超过 10MB'
  }
  return null
}

export async function uploadTaskAttachment(
  userId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const fileError = validateTaskAttachmentFile(file)
  if (fileError) return { path: null, error: fileError }

  if (!isSupabaseConfigured()) {
    return { path: `local://${userId}/${file.name}`, error: null }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const objectPath = `${userId}/${Date.now()}-${safeName}.${ext === safeName ? 'bin' : ext}`

  const { error } = await supabase.storage.from(TASK_ATTACHMENT_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) return { path: null, error: error.message || '附件上传失败' }
  return { path: objectPath, error: null }
}

export async function getTaskAttachmentSignedUrl(
  storedPath: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !storedPath.trim() || storedPath.startsWith('local://')) {
    return null
  }

  const { data, error } = await supabase.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .createSignedUrl(storedPath, expiresIn)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function fetchTasksForPublisher(publisherId: string, isAdmin = false): Promise<Task[]> {
  if (!isSupabaseConfigured()) return []

  let query = supabase.from('tasks').select('*').order('updated_at', { ascending: false })
  if (!isAdmin) {
    query = query.eq('publisher_id', publisherId)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data.map(mapTaskRow)
}

export async function createTask(
  publisherId: string,
  payload: TaskFormPayload,
  status: 'draft' | 'pending',
): Promise<{ task: Task | null; error: string | null }> {
  const validationError = validateTaskPayload(payload, status === 'pending')
  if (validationError) return { task: null, error: validationError }

  if (!isSupabaseConfigured()) {
    return { task: null, error: '未配置 Supabase，请使用本地模式' }
  }

  const now = new Date().toISOString()
  const insert: TaskInsert = {
    publisher_id: publisherId,
    ...toDbPayload(payload),
    status,
    updated_at: now,
  }

  const { data, error } = await supabase.from('tasks').insert(insert).select('*').single()
  if (error || !data) return { task: null, error: error?.message ?? '创建任务失败' }
  return { task: mapTaskRow(data), error: null }
}

export async function updateTask(
  taskId: string,
  payload: Partial<TaskFormPayload> & { status?: TaskStatus },
): Promise<{ task: Task | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { task: null, error: '未配置 Supabase，请使用本地模式' }
  }

  const dbPatch: TaskUpdate = { updated_at: new Date().toISOString() }
  if (payload.title !== undefined) dbPatch.title = payload.title.trim()
  if (payload.taskType !== undefined) dbPatch.task_type = payload.taskType
  if (payload.region !== undefined) dbPatch.region = payload.region
  if (payload.description !== undefined) dbPatch.description = payload.description.trim()
  if (payload.budget !== undefined) dbPatch.budget = payload.budget
  if (payload.deadline !== undefined) dbPatch.deadline = payload.deadline
  if (payload.attachmentUrls !== undefined) dbPatch.attachment_urls = payload.attachmentUrls
  if (payload.status !== undefined) dbPatch.status = payload.status

  const { data, error } = await supabase.from('tasks').update(dbPatch).eq('id', taskId).select('*').single()
  if (error || !data) return { task: null, error: error?.message ?? '更新任务失败' }
  return { task: mapTaskRow(data), error: null }
}

export async function closeTask(taskId: string): Promise<{ ok: boolean; error: string | null }> {
  const { task, error } = await updateTask(taskId, { status: 'closed' })
  return { ok: !!task, error }
}

export function canEditTask(task: Task, isAdmin = false): boolean {
  if (isAdmin) return task.status !== 'completed' && task.status !== 'closed'
  return task.status === 'draft' || task.status === 'pending'
}

export function canAdminTakedownTask(task: Task): boolean {
  return task.status !== 'closed'
}

export function canCloseTask(task: Task): boolean {
  return task.status !== 'completed' && task.status !== 'closed'
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export async function fetchTaskById(taskId: string): Promise<Task | null> {
  if (!isSupabaseConfigured()) {
    return db.getTasks().find((t) => t.id === taskId) ?? null
  }

  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle()
  if (error || !data) return null
  return mapTaskRow(data)
}

interface StatusUpdateContext {
  publisherId?: string
  lawyerId?: string
  isAdmin?: boolean
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  ctx: StatusUpdateContext = {},
): Promise<{ ok: boolean; task: Task | null; error: string | null }> {
  const now = isSupabaseConfigured() ? new Date().toISOString() : formatLocalDateTime()

  const getTask = async () => {
    if (!isSupabaseConfigured()) return db.getTasks().find((t) => t.id === taskId) ?? null
    const { data } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle()
    return data ? mapTaskRow(data) : null
  }

  const task = await getTask()
  if (!task) return { ok: false, task: null, error: '任务不存在' }

  if (!canTransitionTask(task.status, newStatus)) {
    return { ok: false, task: null, error: `无法从「${task.status}」变更为「${newStatus}」` }
  }

  const isPublisher = ctx.publisherId && task.publisherId === ctx.publisherId
  const isAssignedLawyer = ctx.lawyerId && task.assignedLawyerId === ctx.lawyerId
  const isAdmin = ctx.isAdmin ?? false

  if (newStatus === 'awaiting_completion') {
    if (!isAssignedLawyer && !isAdmin) {
      return { ok: false, task: null, error: '仅承接律师可申请完成任务' }
    }
  } else if (newStatus === 'completed' || newStatus === 'disputed') {
    if (!isPublisher && !isAdmin) {
      return { ok: false, task: null, error: '仅发布方可确认完成或提出争议' }
    }
  } else if (newStatus === 'in_progress' && task.status === 'disputed') {
    if (!isPublisher && !isAdmin) {
      return { ok: false, task: null, error: '仅发布方可将争议任务退回进行中' }
    }
  }

  if (!isSupabaseConfigured()) {
    const tasks = db.getTasks()
    const idx = tasks.findIndex((t) => t.id === taskId)
    if (idx < 0) return { ok: false, task: null, error: '任务不存在' }
    const updated = { ...tasks[idx], status: newStatus, updatedAt: now }
    tasks[idx] = updated
    db.saveTasks(tasks)
    return { ok: true, task: updated, error: null }
  }

  let query = supabase.from('tasks').update({ status: newStatus, updated_at: now }).eq('id', taskId)

  if (newStatus === 'awaiting_completion') {
    query = query.eq('assigned_lawyer_id', ctx.lawyerId!).eq('status', 'in_progress')
  } else if (newStatus === 'completed' || newStatus === 'disputed') {
    query = query.eq('status', 'awaiting_completion')
    if (!isAdmin && ctx.publisherId) query = query.eq('publisher_id', ctx.publisherId)
  } else if (newStatus === 'in_progress' && task.status === 'disputed') {
    query = query.eq('status', 'disputed')
    if (!isAdmin && ctx.publisherId) query = query.eq('publisher_id', ctx.publisherId)
  }

  const { data, error } = await query.select('*').maybeSingle()
  if (error) return { ok: false, task: null, error: error.message ?? '状态更新失败' }
  if (!data) return { ok: false, task: null, error: '状态更新失败，请刷新后重试' }
  return { ok: true, task: mapTaskRow(data), error: null }
}

export async function confirmTaskCompletion(
  taskId: string,
  publisherId: string,
  isAdmin = false,
): Promise<{ ok: boolean; error: string | null }> {
  const { ok, error } = await updateTaskStatus(taskId, 'completed', { publisherId, isAdmin })
  return { ok, error }
}

export async function disputeTask(
  taskId: string,
  publisherId: string,
  isAdmin = false,
): Promise<{ ok: boolean; error: string | null }> {
  const { ok, error } = await updateTaskStatus(taskId, 'disputed', { publisherId, isAdmin })
  return { ok, error }
}

export async function reopenDisputedTask(
  taskId: string,
  publisherId: string,
  isAdmin = false,
): Promise<{ ok: boolean; error: string | null }> {
  const { ok, error } = await updateTaskStatus(taskId, 'in_progress', { publisherId, isAdmin })
  return { ok, error }
}
