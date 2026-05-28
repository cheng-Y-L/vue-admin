import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { mapTaskRow } from '@/services/task.service'
import { db } from '@/services/data'
import { formatLocalDateTime } from '@/utils/datetime'
import type { Database } from '@/types/database'
import type {
  Task,
  TaskApplication,
  TaskApplicationStatus,
  PublisherBrief,
  LawyerBrief,
  ApplicationRecord,
} from '@/types'

type ApplicationRow = Database['public']['Tables']['task_applications']['Row']
type ApplicationInsert = Database['public']['Tables']['task_applications']['Insert']

export interface ApplyTaskPayload {
  proposal: string
  quote: number | null
}

export interface LawyerTaskConstraints {
  canApply: boolean
  blockReason: string | null
  pendingApplication: TaskApplication | null
  activeTask: Task | null
}

export interface TaskApplicationWithTask extends TaskApplication {
  task: Task | null
}

export interface TaskApplicationWithLawyer extends TaskApplication {
  lawyer: LawyerBrief | null
}

export function mapApplicationRow(row: ApplicationRow): TaskApplication {
  return {
    id: row.id,
    taskId: row.task_id,
    lawyerId: row.lawyer_id,
    proposal: row.proposal,
    quote: row.quote !== null ? Number(row.quote) : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function validateApplyPayload(payload: ApplyTaskPayload): string | null {
  if (!payload.proposal.trim()) return '请填写承接方案简述'
  if (payload.proposal.trim().length < 10) return '方案简述至少 10 个字'
  if (payload.quote !== null && (isNaN(payload.quote) || payload.quote < 0)) {
    return '请输入有效的报价金额'
  }
  return null
}

export async function fetchOpenTasksForLawyer(): Promise<Task[]> {
  if (!isSupabaseConfigured()) {
    return db
      .getTasks()
      .filter((t) => t.status === 'pending' && !t.assignedLawyerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .is('assigned_lawyer_id', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapTaskRow)
}

export async function fetchTaskForLawyer(taskId: string): Promise<Task | null> {
  if (!isSupabaseConfigured()) {
    return db.getTasks().find((t) => t.id === taskId) ?? null
  }

  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  if (error || !data) return null
  return mapTaskRow(data)
}

export async function fetchPublisherBrief(publisherId: string): Promise<PublisherBrief | null> {
  if (!isSupabaseConfigured()) {
    const user = db.getUsers().find((u) => u.id === publisherId)
    if (!user) {
      return {
        id: publisherId,
        nickname: '演示发布方',
        username: 'demo_publisher',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo_publisher',
      }
    }
    return {
      id: user.id,
      nickname: user.nickname,
      username: user.username,
      avatar: user.avatar,
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, username, avatar')
    .eq('id', publisherId)
    .single()

  if (error || !data) return null
  return {
    id: data.id,
    nickname: data.nickname,
    username: data.username,
    avatar: data.avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
  }
}

export async function fetchMyApplications(lawyerId: string): Promise<TaskApplicationWithTask[]> {
  if (!isSupabaseConfigured()) {
    const tasks = db.getTasks()
    return db
      .getTaskApplications()
      .filter((a) => a.lawyerId === lawyerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((app) => ({
        ...app,
        task: tasks.find((t) => t.id === app.taskId) ?? null,
      }))
  }

  const { data, error } = await supabase
    .from('task_applications')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const tasks = await Promise.all(data.map((row) => fetchTaskForLawyer(row.task_id)))

  return data.map((row, index) => ({
    ...mapApplicationRow(row),
    task: tasks[index],
  }))
}

export async function fetchMyAssignedTasks(lawyerId: string): Promise<Task[]> {
  if (!isSupabaseConfigured()) {
    return db
      .getTasks()
      .filter(
        (t) =>
          t.assignedLawyerId === lawyerId &&
          (t.status === 'in_progress' ||
            t.status === 'awaiting_completion' ||
            t.status === 'disputed' ||
            t.status === 'completed' ||
            t.status === 'closed'),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_lawyer_id', lawyerId)
    .in('status', ['in_progress', 'awaiting_completion', 'disputed', 'completed', 'closed'])
    .order('updated_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapTaskRow)
}

export async function fetchApplicationForTask(
  lawyerId: string,
  taskId: string,
): Promise<TaskApplication | null> {
  if (!isSupabaseConfigured()) {
    return (
      db
        .getTaskApplications()
        .find(
          (a) =>
            a.lawyerId === lawyerId &&
            a.taskId === taskId &&
            (a.status === 'pending' || a.status === 'accepted'),
        ) ?? null
    )
  }

  const { data, error } = await supabase
    .from('task_applications')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .eq('task_id', taskId)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()

  if (error || !data) return null
  return mapApplicationRow(data)
}

export async function getLawyerTaskConstraints(lawyerId: string): Promise<LawyerTaskConstraints> {
  if (!isSupabaseConfigured()) {
    const applications = db.getTaskApplications()
    const tasks = db.getTasks()
    const pendingApplication =
      applications.find((a) => a.lawyerId === lawyerId && a.status === 'pending') ?? null
    const activeTask =
      tasks.find(
        (t) =>
          t.assignedLawyerId === lawyerId &&
          (t.status === 'in_progress' || t.status === 'awaiting_completion' || t.status === 'disputed'),
      ) ?? null

    if (activeTask) {
      return {
        canApply: false,
        blockReason: '您有进行中的任务，暂不可申请新任务',
        pendingApplication,
        activeTask,
      }
    }
    if (pendingApplication) {
      return {
        canApply: false,
        blockReason: '您已有待审核的申请，每次只能申请一个任务',
        pendingApplication,
        activeTask: null,
      }
    }
    return { canApply: true, blockReason: null, pendingApplication: null, activeTask: null }
  }

  const [pendingRes, activeRes] = await Promise.all([
    supabase
      .from('task_applications')
      .select('*')
      .eq('lawyer_id', lawyerId)
      .eq('status', 'pending')
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('*')
      .eq('assigned_lawyer_id', lawyerId)
      .in('status', ['in_progress', 'awaiting_completion', 'disputed'])
      .maybeSingle(),
  ])

  const pendingApplication = pendingRes.data ? mapApplicationRow(pendingRes.data) : null
  const activeTask = activeRes.data ? mapTaskRow(activeRes.data) : null

  if (activeTask) {
    return {
      canApply: false,
      blockReason: '您有进行中的任务，暂不可申请新任务',
      pendingApplication,
      activeTask,
    }
  }

  if (pendingApplication) {
    return {
      canApply: false,
      blockReason: '您已有待审核的申请，每次只能申请一个任务',
      pendingApplication,
      activeTask: null,
    }
  }

  return { canApply: true, blockReason: null, pendingApplication: null, activeTask: null }
}

export async function applyForTask(
  lawyerId: string,
  taskId: string,
  payload: ApplyTaskPayload,
): Promise<{ application: TaskApplication | null; error: string | null }> {
  const validationError = validateApplyPayload(payload)
  if (validationError) return { application: null, error: validationError }

  if (!isSupabaseConfigured()) {
    const constraints = await getLawyerTaskConstraints(lawyerId)
    if (!constraints.canApply) {
      return { application: null, error: constraints.blockReason ?? '当前不可申请任务' }
    }

    const existing = await fetchApplicationForTask(lawyerId, taskId)
    if (existing) {
      return { application: null, error: '您已申请过该任务' }
    }

    const task = await fetchTaskForLawyer(taskId)
    if (!task || task.status !== 'pending' || task.assignedLawyerId) {
      return { application: null, error: '该任务已不可申请' }
    }

    const now = formatLocalDateTime()
    const application: TaskApplication = {
      id: `app_${Math.random().toString(36).substring(2, 9)}`,
      taskId,
      lawyerId,
      proposal: payload.proposal.trim(),
      quote: payload.quote,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    const apps = db.getTaskApplications()
    apps.unshift(application)
    db.saveTaskApplications(apps)
    return { application, error: null }
  }

  const constraints = await getLawyerTaskConstraints(lawyerId)
  if (!constraints.canApply) {
    return { application: null, error: constraints.blockReason ?? '当前不可申请任务' }
  }

  const existing = await fetchApplicationForTask(lawyerId, taskId)
  if (existing) {
    return { application: null, error: '您已申请过该任务' }
  }

  const task = await fetchTaskForLawyer(taskId)
  if (!task || task.status !== 'pending' || task.assignedLawyerId) {
    return { application: null, error: '该任务已不可申请' }
  }

  const now = new Date().toISOString()
  const insert: ApplicationInsert = {
    task_id: taskId,
    lawyer_id: lawyerId,
    proposal: payload.proposal.trim(),
    quote: payload.quote,
    status: 'pending',
    updated_at: now,
  }

  const { data, error } = await supabase.from('task_applications').insert(insert).select('*').single()
  if (error) {
    if (error.code === '23505') {
      return { application: null, error: '您已有待审核的申请，每次只能申请一个任务' }
    }
    return { application: null, error: error.message ?? '申请提交失败' }
  }

  return { application: mapApplicationRow(data), error: null }
}

export async function withdrawApplication(
  applicationId: string,
  lawyerId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const apps = db.getTaskApplications()
    const idx = apps.findIndex(
      (a) => a.id === applicationId && a.lawyerId === lawyerId && a.status === 'pending',
    )
    if (idx < 0) return { ok: false, error: '申请不存在或已不可撤回' }
    apps[idx] = { ...apps[idx], status: 'withdrawn', updatedAt: formatLocalDateTime() }
    db.saveTaskApplications(apps)
    return { ok: true, error: null }
  }

  const { data, error } = await supabase
    .from('task_applications')
    .update({ status: 'withdrawn' as TaskApplicationStatus, updated_at: new Date().toISOString() })
    .eq('id', applicationId)
    .eq('lawyer_id', lawyerId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (error) return { ok: false, error: error.message ?? '撤回失败' }
  if (!data) return { ok: false, error: '申请不存在或已不可撤回' }
  return { ok: true, error: null }
}

function mapLawyerProfileRow(row: {
  id: string
  nickname: string
  username: string
  avatar: string | null
  real_name: string | null
  law_firm: string | null
  license_number: string | null
  practice_area: string | null
  certification_status: string
  license_image_url: string | null
}): LawyerBrief {
  return {
    id: row.id,
    nickname: row.nickname,
    username: row.username,
    avatar: row.avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.username}`,
    realName: row.real_name,
    lawFirm: row.law_firm,
    licenseNumber: row.license_number,
    practiceArea: row.practice_area,
    certificationStatus: row.certification_status as LawyerBrief['certificationStatus'],
    licenseImageUrl: row.license_image_url,
  }
}

export async function fetchLawyerBrief(lawyerId: string): Promise<LawyerBrief | null> {
  if (!isSupabaseConfigured()) {
    const user = db.getUsers().find((u) => u.id === lawyerId)
    if (!user) {
      return {
        id: lawyerId,
        nickname: '演示律师',
        username: 'demo_lawyer',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo_lawyer',
        realName: '李律师',
        lawFirm: '某某律师事务所',
        licenseNumber: '13101234567890123',
        practiceArea: '劳动争议、民事诉讼',
        certificationStatus: 'approved',
      }
    }
    return {
      id: user.id,
      nickname: user.nickname,
      username: user.username,
      avatar: user.avatar,
      realName: user.realName,
      lawFirm: user.lawFirm,
      licenseNumber: user.licenseNumber,
      practiceArea: user.practiceArea,
      certificationStatus: user.certificationStatus,
      licenseImageUrl: user.licenseImageUrl,
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, nickname, username, avatar, real_name, law_firm, license_number, practice_area, certification_status, license_image_url',
    )
    .eq('id', lawyerId)
    .single()

  if (error || !data) return null
  return mapLawyerProfileRow(data)
}

export async function fetchApplicationsForTask(taskId: string): Promise<TaskApplicationWithLawyer[]> {
  if (!isSupabaseConfigured()) {
    const apps = db
      .getTaskApplications()
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const lawyers = await Promise.all(apps.map((app) => fetchLawyerBrief(app.lawyerId)))
    return apps.map((app, index) => ({
      ...app,
      lawyer: lawyers[index],
    }))
  }

  const { data, error } = await supabase
    .from('task_applications')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const lawyers = await Promise.all(data.map((row) => fetchLawyerBrief(row.lawyer_id)))

  return data.map((row, index) => ({
    ...mapApplicationRow(row),
    lawyer: lawyers[index],
  }))
}

export async function fetchPendingApplicationCounts(
  taskIds: string[],
): Promise<Record<string, number>> {
  if (!taskIds.length) return {}

  if (!isSupabaseConfigured()) {
    const counts: Record<string, number> = {}
    for (const app of db.getTaskApplications()) {
      if (app.status === 'pending' && taskIds.includes(app.taskId)) {
        counts[app.taskId] = (counts[app.taskId] ?? 0) + 1
      }
    }
    return counts
  }

  const { data, error } = await supabase
    .from('task_applications')
    .select('task_id')
    .in('task_id', taskIds)
    .eq('status', 'pending')

  if (error || !data) return {}

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.task_id] = (counts[row.task_id] ?? 0) + 1
  }
  return counts
}

async function verifyPublisherCanReviewTask(
  taskId: string,
  userId: string,
  isAdmin = false,
): Promise<{ task: Task | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const task = db.getTasks().find((t) => t.id === taskId) ?? null
    if (!task) return { task: null, error: '任务不存在' }
    if (!isAdmin && task.publisherId !== userId) return { task: null, error: '无权审核该任务的申请' }
    return { task, error: null }
  }

  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  if (error || !data) return { task: null, error: '任务不存在' }
  const task = mapTaskRow(data)
  if (!isAdmin && task.publisherId !== userId) return { task: null, error: '无权审核该任务的申请' }
  return { task, error: null }
}

export async function reviewApplication(
  applicationId: string,
  userId: string,
  decision: 'accepted' | 'rejected',
  isAdmin = false,
): Promise<{ ok: boolean; error: string | null }> {
  const now = isSupabaseConfigured() ? new Date().toISOString() : formatLocalDateTime()

  if (!isSupabaseConfigured()) {
    const apps = db.getTaskApplications()
    const idx = apps.findIndex((a) => a.id === applicationId)
    if (idx < 0) return { ok: false, error: '申请不存在' }

    const app = apps[idx]
    if (app.status !== 'pending') return { ok: false, error: '该申请已处理' }

    const { task, error: taskError } = await verifyPublisherCanReviewTask(app.taskId, userId, isAdmin)
    if (taskError || !task) return { ok: false, error: taskError ?? '任务不存在' }

    if (decision === 'accepted') {
      if (task.status !== 'pending' || task.assignedLawyerId) {
        return { ok: false, error: '该任务已不可分配律师' }
      }

      apps[idx] = { ...app, status: 'accepted', updatedAt: now }
      for (let i = 0; i < apps.length; i++) {
        if (apps[i].taskId === app.taskId && apps[i].status === 'pending' && apps[i].id !== applicationId) {
          apps[i] = { ...apps[i], status: 'rejected', updatedAt: now }
        }
      }
      db.saveTaskApplications(apps)

      const tasks = db.getTasks()
      const taskIdx = tasks.findIndex((t) => t.id === app.taskId)
      if (taskIdx >= 0) {
        tasks[taskIdx] = {
          ...tasks[taskIdx],
          assignedLawyerId: app.lawyerId,
          status: 'in_progress',
          updatedAt: now,
        }
        db.saveTasks(tasks)
      }
    } else {
      apps[idx] = { ...app, status: 'rejected', updatedAt: now }
      db.saveTaskApplications(apps)
    }

    return { ok: true, error: null }
  }

  const { data: appRow, error: appError } = await supabase
    .from('task_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle()

  if (appError || !appRow) return { ok: false, error: '申请不存在' }
  if (appRow.status !== 'pending') return { ok: false, error: '该申请已处理' }

  const { task, error: taskError } = await verifyPublisherCanReviewTask(appRow.task_id, userId, isAdmin)
  if (taskError || !task) return { ok: false, error: taskError ?? '任务不存在' }

  if (decision === 'accepted') {
    if (task.status !== 'pending' || task.assignedLawyerId) {
      return { ok: false, error: '该任务已不可分配律师' }
    }

    let taskQuery = supabase
      .from('tasks')
      .update({
        assigned_lawyer_id: appRow.lawyer_id,
        status: 'in_progress',
        updated_at: now,
      })
      .eq('id', appRow.task_id)
      .eq('status', 'pending')
      .is('assigned_lawyer_id', null)

    if (!isAdmin) {
      taskQuery = taskQuery.eq('publisher_id', userId)
    }

    const { error: taskUpdateError } = await taskQuery

    if (taskUpdateError) return { ok: false, error: taskUpdateError.message ?? '任务分配失败' }

    const { error: acceptError } = await supabase
      .from('task_applications')
      .update({ status: 'accepted', updated_at: now })
      .eq('id', applicationId)
      .eq('status', 'pending')

    if (acceptError) return { ok: false, error: acceptError.message ?? '审核失败' }

    await supabase
      .from('task_applications')
      .update({ status: 'rejected', updated_at: now })
      .eq('task_id', appRow.task_id)
      .eq('status', 'pending')
      .neq('id', applicationId)
  } else {
    const { error: rejectError } = await supabase
      .from('task_applications')
      .update({ status: 'rejected', updated_at: now })
      .eq('id', applicationId)
      .eq('status', 'pending')

    if (rejectError) return { ok: false, error: rejectError.message ?? '驳回失败' }
  }

  return { ok: true, error: null }
}

export async function fetchAllApplicationRecords(): Promise<ApplicationRecord[]> {
  if (!isSupabaseConfigured()) {
    const tasks = db.getTasks()
    const apps = db.getTaskApplications().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const records = await Promise.all(
      apps.map(async (app) => {
        const task = tasks.find((t) => t.id === app.taskId) ?? null
        const [lawyer, publisher] = await Promise.all([
          fetchLawyerBrief(app.lawyerId),
          task ? fetchPublisherBrief(task.publisherId) : Promise.resolve(null),
        ])
        return { ...app, task, lawyer, publisher }
      }),
    )
    return records
  }

  const { data, error } = await supabase
    .from('task_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const records = await Promise.all(
    data.map(async (row) => {
      const app = mapApplicationRow(row)
      const task = await fetchTaskForLawyer(row.task_id)
      const [lawyer, publisher] = await Promise.all([
        fetchLawyerBrief(row.lawyer_id),
        task ? fetchPublisherBrief(task.publisherId) : Promise.resolve(null),
      ])
      return { ...app, task, lawyer, publisher }
    }),
  )
  return records
}
