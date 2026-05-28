import type { TaskStatus } from './tasks'

export const SETTLEMENT_STATUSES = [
  'awaiting',
  'fulfilling',
  'pending_settlement',
  'disputed',
  'settled',
  'closed',
] as const

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  awaiting: '待锁定',
  fulfilling: '履约中',
  pending_settlement: '待结算',
  disputed: '争议冻结',
  settled: '已结算',
  closed: '已关闭',
}

export const SETTLEMENT_STATUS_CLASS: Record<SettlementStatus, string> = {
  awaiting: 'bg-amber-50 text-amber-700',
  fulfilling: 'bg-blue-50 text-blue-600',
  pending_settlement: 'bg-violet-50 text-violet-700',
  disputed: 'bg-orange-50 text-orange-700',
  settled: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-red-50 text-red-600',
}

export const SETTLEMENT_STATUS_DOT_CLASS: Record<SettlementStatus, string> = {
  awaiting: 'bg-amber-500',
  fulfilling: 'bg-blue-500 animate-pulse',
  pending_settlement: 'bg-violet-500 animate-pulse',
  disputed: 'bg-orange-500',
  settled: 'bg-emerald-600',
  closed: 'bg-red-500',
}

export function taskStatusToSettlement(status: TaskStatus): SettlementStatus | null {
  switch (status) {
    case 'draft':
      return null
    case 'pending':
      return 'awaiting'
    case 'in_progress':
      return 'fulfilling'
    case 'awaiting_completion':
      return 'pending_settlement'
    case 'disputed':
      return 'disputed'
    case 'completed':
      return 'settled'
    case 'closed':
      return 'closed'
    default:
      return null
  }
}
