export const TASK_TYPES = [
  '民事诉讼',
  '刑事辩护',
  '商事仲裁',
  '劳动争议',
  '知识产权',
  '婚姻家庭',
  '行政诉讼',
  '法律顾问',
  '合同审查',
  '其他',
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export const TASK_REGIONS = [
  '全国',
  '北京市',
  '上海市',
  '广东省',
  '浙江省',
  '江苏省',
  '四川省',
  '湖北省',
  '湖南省',
  '山东省',
  '河南省',
  '福建省',
  '其他',
] as const

export type TaskRegion = (typeof TASK_REGIONS)[number]

export const TASK_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'awaiting_completion',
  'completed',
  'disputed',
  'closed',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: '草稿',
  pending: '待承接',
  in_progress: '进行中',
  awaiting_completion: '待确认完成',
  completed: '已完成',
  disputed: '争议中',
  closed: '已关闭',
}

export const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  draft: 'bg-slate-50 text-slate-600',
  pending: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-600',
  awaiting_completion: 'bg-violet-50 text-violet-700',
  completed: 'bg-emerald-50 text-emerald-700',
  disputed: 'bg-orange-50 text-orange-700',
  closed: 'bg-red-50 text-red-600',
}

export const TASK_STATUS_DOT_CLASS: Record<TaskStatus, string> = {
  draft: 'bg-slate-400',
  pending: 'bg-amber-500',
  in_progress: 'bg-blue-500 animate-pulse',
  awaiting_completion: 'bg-violet-500 animate-pulse',
  completed: 'bg-emerald-600',
  disputed: 'bg-orange-500',
  closed: 'bg-red-500',
}

/** 合法的状态流转 */
export const TASK_STATUS_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  pending: ['in_progress', 'closed'],
  in_progress: ['awaiting_completion', 'closed'],
  awaiting_completion: ['completed', 'disputed'],
  disputed: ['in_progress', 'completed', 'closed'],
}

export const TASK_SUBMISSION_TYPES = ['progress', 'completion'] as const
export type TaskSubmissionType = (typeof TASK_SUBMISSION_TYPES)[number]

export const TASK_SUBMISSION_TYPE_LABELS: Record<TaskSubmissionType, string> = {
  progress: '阶段报告',
  completion: '完成申请',
}

export const TASK_ATTACHMENT_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp'

export const TASK_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

export const TASK_ATTACHMENT_BUCKET = 'task-attachments'

export const TASK_APPLICATION_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const

export type TaskApplicationStatus = (typeof TASK_APPLICATION_STATUSES)[number]

export const TASK_APPLICATION_STATUS_LABELS: Record<TaskApplicationStatus, string> = {
  pending: '待审核',
  accepted: '已中标',
  rejected: '未通过',
  withdrawn: '已撤回',
}

export const TASK_APPLICATION_STATUS_CLASS: Record<TaskApplicationStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
  withdrawn: 'bg-slate-50 text-slate-500',
}

export const TASK_PUBLISH_TIME_FILTERS = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
] as const

export type TaskPublishTimeFilter = (typeof TASK_PUBLISH_TIME_FILTERS)[number]['value']

/** 图表用任务类型配色 */
export const TASK_TYPE_COLORS: Record<string, string> = {
  民事诉讼: '#3b82f6',
  刑事辩护: '#ef4444',
  商事仲裁: '#8b5cf6',
  劳动争议: '#f59e0b',
  知识产权: '#10b981',
  婚姻家庭: '#ec4899',
  行政诉讼: '#6366f1',
  法律顾问: '#14b8a6',
  合同审查: '#fa8231',
  其他: '#94a3b8',
}

/** 图表用任务状态配色 */
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  draft: '#94a3b8',
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  awaiting_completion: '#8b5cf6',
  completed: '#10b981',
  disputed: '#f97316',
  closed: '#ef4444',
}

const REGION_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#fa8231',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
  '#ef4444',
  '#94a3b8',
  '#64748b',
  '#06b6d4',
  '#a855f7',
]

export function taskTypeColor(type: string): string {
  return TASK_TYPE_COLORS[type] ?? '#94a3b8'
}

export function taskStatusColor(status: TaskStatus): string {
  return TASK_STATUS_COLORS[status]
}

export function taskRegionColor(region: string, index: number): string {
  if (region === '其他') return '#94a3b8'
  const idx = TASK_REGIONS.indexOf(region as TaskRegion)
  return REGION_PALETTE[(idx >= 0 ? idx : index) % REGION_PALETTE.length]
}
