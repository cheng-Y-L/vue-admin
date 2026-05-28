/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserRole } from './constants/roles'

export type { UserRole }

export type LawyerCertificationStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface User {
  id: string;
  username: string;
  nickname: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  permissions: string[]; // e.g., ['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view']
  status: 'active' | 'suspended';
  avatar: string;
  createTime: string;
  /** 律师资质认证状态（非律师角色可忽略） */
  certificationStatus: LawyerCertificationStatus;
  realName?: string | null;
  idCard?: string | null;
  lawFirm?: string | null;
  licenseNumber?: string | null;
  /** Storage 对象路径或历史完整 URL，展示时需签名 */
  licenseImageUrl?: string | null;
  practiceArea?: string | null;
}

export type TaskStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'awaiting_completion'
  | 'completed'
  | 'disputed'
  | 'closed'

export interface Task {
  id: string
  publisherId: string
  title: string
  taskType: string
  region: string
  description: string
  budget: number | null
  deadline: string | null
  attachmentUrls: string[]
  status: TaskStatus
  assignedLawyerId?: string | null
  createdAt: string
  updatedAt: string
}

export type TaskApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export interface TaskApplication {
  id: string
  taskId: string
  lawyerId: string
  proposal: string
  quote: number | null
  status: TaskApplicationStatus
  createdAt: string
  updatedAt: string
}

/** 任务详情页展示的发布方摘要（不含敏感信息） */
export interface PublisherBrief {
  id: string
  nickname: string
  username: string
  avatar: string
}

/** 申请审核页展示的律师摘要（不含身份证等敏感信息） */
export interface LawyerBrief {
  id: string
  nickname: string
  username: string
  avatar: string
  realName?: string | null
  lawFirm?: string | null
  licenseNumber?: string | null
  practiceArea?: string | null
  certificationStatus: LawyerCertificationStatus
  licenseImageUrl?: string | null
}

export type TaskSubmissionType = 'progress' | 'completion'

export interface TaskSubmission {
  id: string
  taskId: string
  lawyerId: string
  title: string
  content: string
  attachmentUrls: string[]
  submissionType: TaskSubmissionType
  createdAt: string
}

export type SettlementStatus =
  | 'awaiting'
  | 'fulfilling'
  | 'pending_settlement'
  | 'disputed'
  | 'settled'
  | 'closed'

/** 由任务派生的收支履约记录（发布方视角为支出，律师视角为收入） */
export interface TaskSettlementRecord {
  id: string
  taskId: string
  taskTitle: string
  taskType: string
  region: string
  taskStatus: TaskStatus
  settlementStatus: SettlementStatus
  direction: 'income' | 'expense'
  budget: number | null
  agreedAmount: number | null
  publisherId: string
  publisherName: string
  lawyerId: string | null
  lawyerName: string | null
  updatedAt: string
  createdAt: string
}

/** @deprecated 旧版电商演示数据，驾驶舱统计仍可能引用 */
export interface Order {
  id: string;
  customerName: string;
  email: string;
  productName: string;
  category: string;
  amount: number;
  status: 'pending' | 'shipping' | 'completed' | 'canceled';
  date: string;
  paymentMethod: 'Alipay' | 'WeChatPay' | 'CreditCard' | 'PayPal';
}

export interface SystemLog {
  id: string;
  operator: string;
  role: string;
  action: string;
  ip: string;
  module: 'Auth' | 'UserManage' | 'OrderManage' | 'TaskManage' | 'Permissions' | 'SystemSettings' | 'ContentManage';
  status: 'success' | 'failed';
  timestamp: string;
}

/** @deprecated 旧版电商演示数据，本地存储初始化仍可能引用 */
export interface StatSummary {
  todaySales: number;
  todaySalesChange: number; // percentage, e.g., 12 => +12%
  todayOrders: number;
  todayOrdersChange: number;
  activeUsers: number;
  activeUsersChange: number;
  conversionRate: number;
  conversionRateChange: number;
}

/** @deprecated 旧版电商演示数据 */
export interface DashboardMetric {
  date: string;
  sales: number;
  orders: number;
  visitors: number;
}

/** @deprecated 旧版电商演示数据 */
export interface CategoryRatio {
  category: string;
  sales: number;
  count: number;
  color: string;
}

/** 任务统计时间序列点 */
export interface TaskStatsTimePoint {
  date: string
  published: number
  completed: number
  applications: number
  budgetAmount: number
}

/** 任务统计分布项（类型 / 状态 / 地域） */
export interface TaskStatsDistribution {
  label: string
  count: number
  amount: number
  color: string
}

/** 任务生命周期漏斗步骤 */
export interface TaskStatsFunnelStep {
  name: string
  value: string
  count: number
  rate: number
  color: string
  desc: string
}

/** KPI 卡片 */
export interface TaskStatsKpiCard {
  title: string
  value: string
  change: number
}

/** 结算管道分段 */
export interface TaskStatsPipelineSegment {
  count: number
  amount: number
}

export interface TaskStatsSettlementPipeline {
  awaiting: TaskStatsPipelineSegment
  fulfilling: TaskStatsPipelineSegment
  pendingSettlement: TaskStatsPipelineSegment
  settled: TaskStatsPipelineSegment
}

/** 任务域统计总览 */
export interface TaskStatsOverview {
  range: '7d' | '15d' | '30d'
  summary: {
    kpiCards: TaskStatsKpiCard[]
    totalPublished: number
    totalCompleted: number
    totalApplications: number
    totalBudgetAmount: number
    totalSettledAmount: number
  }
  trend: TaskStatsTimePoint[]
  statusDistribution: TaskStatsDistribution[]
  typeDistribution: TaskStatsDistribution[]
  regionDistribution: TaskStatsDistribution[]
  funnel: TaskStatsFunnelStep[]
  settlementPipeline: TaskStatsSettlementPipeline
  insights: string[]
}

/** 管理员平台数据看板 */
export interface AdminPlatformStats {
  userCount: number
  activeUserCount: number
  lawyerCount: number
  publisherCount: number
  taskCount: number
  pendingTaskCount: number
  inProgressTaskCount: number
  completedTaskCount: number
  closedTaskCount: number
  applicationCount: number
  pendingApplicationCount: number
  settledCount: number
  settledAmount: number
}

/** 全局申请记录（含关联信息） */
export interface ApplicationRecord extends TaskApplication {
  task: Task | null
  lawyer: LawyerBrief | null
  publisher: PublisherBrief | null
}
