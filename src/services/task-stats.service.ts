import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { mapTaskRow } from '@/services/task.service'
import { mapApplicationRow } from '@/services/task-application.service'
import { fetchSettlementRecords } from '@/services/task-settlement.service'
import { db } from '@/services/data'
import { normalizeRole, type UserRole } from '@/constants/roles'
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_REGIONS,
  taskTypeColor,
  taskStatusColor,
  taskRegionColor,
} from '@/constants/tasks'
import type {
  Task,
  TaskApplication,
  TaskStatsOverview,
  TaskStatsTimePoint,
  TaskStatsDistribution,
  TaskStatsFunnelStep,
  TaskStatsKpiCard,
  TaskStatsSettlementPipeline,
} from '@/types'

export type TaskStatsRange = '7d' | '15d' | '30d'

const RANGE_DAYS: Record<TaskStatsRange, number> = {
  '7d': 7,
  '15d': 15,
  '30d': 30,
}

function parseDate(value: string): Date {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

function formatDateLabel(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isInRange(date: Date, start: Date, end: Date): boolean {
  const t = startOfDay(date).getTime()
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime()
}

function formatAmount(amount: number): string {
  if (amount >= 10000) return `¥${(amount / 10000).toFixed(1)}万`
  return `¥${amount.toLocaleString()}`
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function sumBudget(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + (t.budget ?? 0), 0)
}

async function fetchRawTasks(userId: string, role: UserRole): Promise<Task[]> {
  const normalizedRole = normalizeRole(role)

  if (!isSupabaseConfigured()) {
    const all = db.getTasks()
    if (normalizedRole === 'admin') return all
    if (normalizedRole === 'publisher') {
      return all.filter((t) => t.publisherId === userId || t.publisherId === 'demo_publisher')
    }
    const open = all.filter((t) => t.status === 'pending' && !t.assignedLawyerId)
    const assigned = all.filter((t) => t.assignedLawyerId === userId)
    const merged = new Map<string, Task>()
    for (const t of [...open, ...assigned]) merged.set(t.id, t)
    return [...merged.values()]
  }

  if (normalizedRole === 'admin') {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map(mapTaskRow)
  }

  if (normalizedRole === 'publisher') {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('publisher_id', userId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map(mapTaskRow)
  }

  const [openRes, assignedRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('status', 'pending')
      .is('assigned_lawyer_id', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('*')
      .eq('assigned_lawyer_id', userId)
      .order('updated_at', { ascending: false }),
  ])

  const merged = new Map<string, Task>()
  for (const row of openRes.data ?? []) merged.set(row.id, mapTaskRow(row))
  for (const row of assignedRes.data ?? []) merged.set(row.id, mapTaskRow(row))
  return [...merged.values()]
}

async function fetchRawApplications(userId: string, role: UserRole, tasks: Task[]): Promise<TaskApplication[]> {
  const normalizedRole = normalizeRole(role)

  if (!isSupabaseConfigured()) {
    const all = db.getTaskApplications()
    if (normalizedRole === 'admin') return all
    if (normalizedRole === 'publisher') {
      const taskIds = new Set(tasks.map((t) => t.id))
      return all.filter((a) => taskIds.has(a.taskId))
    }
    return all.filter((a) => a.lawyerId === userId)
  }

  if (normalizedRole === 'admin') {
    const { data, error } = await supabase
      .from('task_applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map(mapApplicationRow)
  }

  if (normalizedRole === 'publisher') {
    const taskIds = tasks.map((t) => t.id)
    if (!taskIds.length) return []
    const { data, error } = await supabase
      .from('task_applications')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map(mapApplicationRow)
  }

  const { data, error } = await supabase
    .from('task_applications')
    .select('*')
    .eq('lawyer_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(mapApplicationRow)
}

function buildTrend(
  tasks: Task[],
  applications: TaskApplication[],
  range: TaskStatsRange,
): TaskStatsTimePoint[] {
  const days = RANGE_DAYS[range]
  const end = startOfDay(new Date())
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))

  const points: TaskStatsTimePoint[] = []
  for (let i = 0; i < days; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)

    const published = tasks.filter(
      (t) => t.status !== 'draft' && isSameDay(parseDate(t.createdAt), day),
    ).length

    const completed = tasks.filter(
      (t) => t.status === 'completed' && isSameDay(parseDate(t.updatedAt), day),
    ).length

    const apps = applications.filter((a) => isSameDay(parseDate(a.createdAt), day)).length

    const budgetAmount = tasks
      .filter((t) => t.status !== 'draft' && isSameDay(parseDate(t.createdAt), day))
      .reduce((sum, t) => sum + (t.budget ?? 0), 0)

    points.push({
      date: formatDateLabel(day),
      published,
      completed,
      applications: apps,
      budgetAmount,
    })
  }
  return points
}

function buildDistribution(
  tasks: Task[],
  labels: readonly string[],
  getLabel: (t: Task) => string,
  getColor: (label: string, index: number) => string,
): TaskStatsDistribution[] {
  const relevant = tasks.filter((t) => t.status !== 'draft')
  const map = new Map<string, { count: number; amount: number }>()

  for (const label of labels) {
    map.set(label, { count: 0, amount: 0 })
  }

  for (const t of relevant) {
    const label = getLabel(t)
    const entry = map.get(label) ?? { count: 0, amount: 0 }
    entry.count += 1
    entry.amount += t.budget ?? 0
    map.set(label, entry)
  }

  return [...map.entries()]
    .filter(([, v]) => v.count > 0)
    .map(([label, v], i) => ({
      label,
      count: v.count,
      amount: v.amount,
      color: getColor(label, i),
    }))
    .sort((a, b) => b.count - a.count)
}

function buildStatusDistribution(tasks: Task[]): TaskStatsDistribution[] {
  const relevant = tasks.filter((t) => t.status !== 'draft')
  return TASK_STATUSES.filter((s) => s !== 'draft')
    .map((status) => {
      const matched = relevant.filter((t) => t.status === status)
      return {
        label: TASK_STATUS_LABELS[status],
        count: matched.length,
        amount: sumBudget(matched),
        color: taskStatusColor(status),
      }
    })
    .filter((d) => d.count > 0)
}

function buildFunnel(tasks: Task[], role: UserRole): TaskStatsFunnelStep[] {
  const normalizedRole = normalizeRole(role)
  const nonDraft = tasks.filter((t) => t.status !== 'draft')
  const published = nonDraft.length
  const pending = nonDraft.filter((t) => t.status === 'pending').length
  const assigned = nonDraft.filter((t) => !!t.assignedLawyerId).length
  const inProgress = nonDraft.filter(
    (t) =>
      t.status === 'in_progress' ||
      t.status === 'awaiting_completion' ||
      t.status === 'disputed',
  ).length
  const completed = nonDraft.filter((t) => t.status === 'completed').length

  const base = published || 1
  const steps: TaskStatsFunnelStep[] = [
    {
      name: normalizedRole === 'lawyer' ? '可接任务曝光' : '已发布任务',
      value: `${published} 个`,
      count: published,
      rate: 100,
      color: '#3b82f6',
      desc: normalizedRole === 'lawyer' ? '任务大厅开放承接的任务' : '进入平台的有效任务',
    },
    {
      name: '待承接',
      value: `${pending} 个`,
      count: pending,
      rate: Math.round((pending / base) * 1000) / 10,
      color: '#f59e0b',
      desc: '等待律师申请承接',
    },
    {
      name: '已中标',
      value: `${assigned} 个`,
      count: assigned,
      rate: Math.round((assigned / base) * 1000) / 10,
      color: '#8b5cf6',
      desc: '已选定律师并开始履约',
    },
    {
      name: '履约中',
      value: `${inProgress} 个`,
      count: inProgress,
      rate: Math.round((inProgress / base) * 1000) / 10,
      color: '#10b981',
      desc: '进行中、待确认或争议处理',
    },
    {
      name: '已完成',
      value: `${completed} 个`,
      count: completed,
      rate: Math.round((completed / base) * 1000) / 10,
      color: '#fa8231',
      desc: '发布方确认完成',
    },
  ]
  return steps
}

function buildSettlementPipeline(records: Awaited<ReturnType<typeof fetchSettlementRecords>>): TaskStatsSettlementPipeline {
  const sumAmount = (list: typeof records) =>
    list.reduce((sum, r) => sum + (r.agreedAmount ?? 0), 0)

  const awaiting = records.filter((r) => r.settlementStatus === 'awaiting')
  const fulfilling = records.filter(
    (r) => r.settlementStatus === 'fulfilling' || r.settlementStatus === 'disputed',
  )
  const pendingSettlement = records.filter((r) => r.settlementStatus === 'pending_settlement')
  const settled = records.filter((r) => r.settlementStatus === 'settled')

  return {
    awaiting: { count: awaiting.length, amount: sumAmount(awaiting) },
    fulfilling: { count: fulfilling.length, amount: sumAmount(fulfilling) },
    pendingSettlement: { count: pendingSettlement.length, amount: sumAmount(pendingSettlement) },
    settled: { count: settled.length, amount: sumAmount(settled) },
  }
}

function countInPeriod(
  tasks: Task[],
  applications: TaskApplication[],
  start: Date,
  end: Date,
) {
  const published = tasks.filter(
    (t) => t.status !== 'draft' && isInRange(parseDate(t.createdAt), start, end),
  ).length
  const completed = tasks.filter(
    (t) => t.status === 'completed' && isInRange(parseDate(t.updatedAt), start, end),
  ).length
  const apps = applications.filter((a) => isInRange(parseDate(a.createdAt), start, end)).length
  const budgetAmount = tasks
    .filter((t) => t.status !== 'draft' && isInRange(parseDate(t.createdAt), start, end))
    .reduce((sum, t) => sum + (t.budget ?? 0), 0)
  return { published, completed, applications: apps, budgetAmount }
}

function buildKpiCards(
  tasks: Task[],
  applications: TaskApplication[],
  range: TaskStatsRange,
  role: UserRole,
  settledAmount: number,
): TaskStatsKpiCard[] {
  const normalizedRole = normalizeRole(role)
  const days = RANGE_DAYS[range]
  const end = startOfDay(new Date())
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (days - 1))

  const current = countInPeriod(tasks, applications, start, end)
  const previous = countInPeriod(tasks, applications, prevStart, prevEnd)

  const nonDraft = tasks.filter((t) => t.status !== 'draft')
  const pendingApps = applications.filter((a) => a.status === 'pending').length
  const openHall = tasks.filter((t) => t.status === 'pending' && !t.assignedLawyerId).length
  const inProgress = nonDraft.filter(
    (t) =>
      t.status === 'in_progress' ||
      t.status === 'awaiting_completion' ||
      t.status === 'disputed',
  ).length
  const completed = nonDraft.filter((t) => t.status === 'completed').length
  const pendingTasks = nonDraft.filter((t) => t.status === 'pending').length

  const today = startOfDay(new Date())
  const todayPublished = tasks.filter(
    (t) => t.status !== 'draft' && isSameDay(parseDate(t.createdAt), today),
  ).length
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayPublished = tasks.filter(
    (t) => t.status !== 'draft' && isSameDay(parseDate(t.createdAt), yesterday),
  ).length

  if (normalizedRole === 'admin') {
    return [
      {
        title: '平台任务总量',
        value: `${nonDraft.length} 个`,
        change: pctChange(current.published, previous.published),
      },
      {
        title: '待承接 / 进行中',
        value: `${pendingTasks} / ${inProgress}`,
        change: pctChange(pendingTasks + inProgress, previous.published),
      },
      {
        title: '今日新发布',
        value: `${todayPublished} 个`,
        change: pctChange(todayPublished, yesterdayPublished),
      },
      {
        title: '已完成 / 结算总额',
        value: `${completed} / ${formatAmount(settledAmount)}`,
        change: pctChange(current.completed, previous.completed),
      },
    ]
  }

  if (normalizedRole === 'publisher') {
    return [
      {
        title: '我的任务总数',
        value: `${nonDraft.length} 个`,
        change: pctChange(current.published, previous.published),
      },
      {
        title: '待审核申请',
        value: `${pendingApps} 条`,
        change: pctChange(current.applications, previous.applications),
      },
      {
        title: '履约中任务',
        value: `${inProgress} 个`,
        change: pctChange(inProgress, previous.completed),
      },
      {
        title: '已结算支出',
        value: formatAmount(settledAmount),
        change: pctChange(current.budgetAmount, previous.budgetAmount),
      },
    ]
  }

  const myPendingApps = applications.filter((a) => a.status === 'pending').length
  const myActive = tasks.filter(
    (t) =>
      t.assignedLawyerId &&
      (t.status === 'in_progress' ||
        t.status === 'awaiting_completion' ||
        t.status === 'disputed'),
  ).length

  return [
    {
      title: '大厅可接任务',
      value: `${openHall} 个`,
      change: pctChange(openHall, previous.published),
    },
    {
      title: '我的待审申请',
      value: `${myPendingApps} 条`,
      change: pctChange(current.applications, previous.applications),
    },
    {
      title: '进行中任务',
      value: `${myActive} 个`,
      change: pctChange(myActive, previous.completed),
    },
    {
      title: '累计收入',
      value: formatAmount(settledAmount),
      change: pctChange(current.budgetAmount, previous.budgetAmount),
    },
  ]
}

function buildInsights(
  tasks: Task[],
  applications: TaskApplication[],
  typeDistribution: TaskStatsDistribution[],
  statusDistribution: TaskStatsDistribution[],
  pipeline: TaskStatsSettlementPipeline,
  role: UserRole,
): string[] {
  const normalizedRole = normalizeRole(role)
  const insights: string[] = []
  const pendingApps = applications.filter((a) => a.status === 'pending').length
  const topType = typeDistribution[0]

  if (topType) {
    insights.push(`当前「${topType.label}」类任务占比最高（${topType.count} 个），可重点匹配对应领域律师。`)
  }

  if (pendingApps > 0 && (normalizedRole === 'publisher' || normalizedRole === 'admin')) {
    insights.push(`有 ${pendingApps} 条律师申请待审核，建议尽快处理以提升承接效率。`)
  }

  const awaitingCompletion = statusDistribution.find((d) => d.label === TASK_STATUS_LABELS.awaiting_completion)
  if (awaitingCompletion && awaitingCompletion.count > 0) {
    insights.push(`${awaitingCompletion.count} 个任务待确认完成，请及时审核交付成果。`)
  }

  if (pipeline.fulfilling.count > 0) {
    insights.push(
      `履约中任务 ${pipeline.fulfilling.count} 个，涉及金额 ${formatAmount(pipeline.fulfilling.amount)}。`,
    )
  }

  if (normalizedRole === 'lawyer') {
    const openHall = tasks.filter((t) => t.status === 'pending' && !t.assignedLawyerId).length
    if (openHall > 0) {
      insights.push(`任务大厅现有 ${openHall} 个开放任务，可前往筛选并提交申请。`)
    }
    const rejected = applications.filter((a) => a.status === 'rejected').length
    if (rejected > 0) {
      insights.push(`历史未通过申请 ${rejected} 条，可优化方案简述与报价策略。`)
    }
  }

  if (insights.length === 0) {
    insights.push('当前任务数据平稳，可继续发布或承接新任务。')
  }

  return insights.slice(0, 4)
}

export async function fetchTaskStatsOverview(
  userId: string,
  role: UserRole,
  range: TaskStatsRange = '15d',
): Promise<TaskStatsOverview> {
  const [tasks, settlementRecords] = await Promise.all([
    fetchRawTasks(userId, role),
    fetchSettlementRecords(userId, role),
  ])
  const applications = await fetchRawApplications(userId, role, tasks)

  const trend = buildTrend(tasks, applications, range)
  const typeDistribution = buildDistribution(
    tasks,
    TASK_TYPES,
    (t) => t.taskType,
    (label) => taskTypeColor(label),
  )
  const regionDistribution = buildDistribution(
    tasks,
    TASK_REGIONS,
    (t) => t.region,
    (label, i) => taskRegionColor(label, i),
  )
  const statusDistribution = buildStatusDistribution(tasks)
  const funnel = buildFunnel(tasks, role)
  const settlementPipeline = buildSettlementPipeline(settlementRecords)
  const settledAmount = settlementPipeline.settled.amount

  const totalPublished = trend.reduce((s, p) => s + p.published, 0)
  const totalCompleted = trend.reduce((s, p) => s + p.completed, 0)
  const totalApplications = trend.reduce((s, p) => s + p.applications, 0)
  const totalBudgetAmount = trend.reduce((s, p) => s + p.budgetAmount, 0)

  const kpiCards = buildKpiCards(tasks, applications, range, role, settledAmount)
  const insights = buildInsights(
    tasks,
    applications,
    typeDistribution,
    statusDistribution,
    settlementPipeline,
    role,
  )

  return {
    range,
    summary: {
      kpiCards,
      totalPublished,
      totalCompleted,
      totalApplications,
      totalBudgetAmount,
      totalSettledAmount: settledAmount,
    },
    trend,
    statusDistribution,
    typeDistribution,
    regionDistribution,
    funnel,
    settlementPipeline,
    insights,
  }
}
