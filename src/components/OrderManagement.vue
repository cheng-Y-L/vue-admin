<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Wallet,
  Search,
  FileSpreadsheet,
  Lock,
  Copy,
  Check,
  XCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from '@lucide/vue'
import { roleLabel as formatRoleLabel, roleHasPermission } from '@/constants/roles'
import {
  SETTLEMENT_STATUS_LABELS,
  SETTLEMENT_STATUS_CLASS,
  SETTLEMENT_STATUS_DOT_CLASS,
  type SettlementStatus,
} from '@/constants/settlements'
import { TASK_TYPES } from '@/constants/tasks'
import { db } from '@/services/data'
import { fetchSettlementRecords } from '@/services/task-settlement.service'
import type { TaskSettlementRecord, User } from '@/types'

const props = defineProps<{ currentUser: User }>()

type StatusFilter = 'all' | SettlementStatus
type DirectionFilter = 'all' | 'income' | 'expense'

const router = useRouter()
const records = ref<TaskSettlementRecord[]>([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref<StatusFilter>('all')
const typeFilter = ref('all')
const directionFilter = ref<DirectionFilter>('all')
const exportedData = ref<string | null>(null)
const copied = ref(false)

const isAdmin = computed(() => props.currentUser.role === 'admin')
const isPublisher = computed(() => props.currentUser.role === 'publisher')
const isLawyer = computed(() => props.currentUser.role === 'lawyer')
const canManage = computed(() =>
  roleHasPermission(props.currentUser.role, props.currentUser.permissions, 'order_manage'),
)
const currentRoleLabel = computed(() => formatRoleLabel(props.currentUser.role))

const pageTitle = computed(() => {
  if (isLawyer.value) return '我的收入与履约'
  if (isPublisher.value) return '任务支出与履约'
  return '平台收支履约总览'
})

const pageSubtitle = computed(() => {
  if (isLawyer.value) return '基于已承接任务查看报价、履约进度与结算状态'
  if (isPublisher.value) return '基于已发布任务跟踪预算锁定、履约进度与结算支出'
  return '汇总全平台任务委托的资金流转与履约节点'
})

const directionLabel = computed(() => (isLawyer.value ? '收入' : '支出'))

onMounted(async () => {
  loading.value = true
  records.value = await fetchSettlementRecords(props.currentUser.id, props.currentUser.role)
  loading.value = false
})

const filteredRecords = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return records.value.filter((r) => {
    const matchesSearch =
      !query ||
      r.taskTitle.toLowerCase().includes(query) ||
      r.taskType.toLowerCase().includes(query) ||
      r.region.toLowerCase().includes(query) ||
      r.publisherName.toLowerCase().includes(query) ||
      (r.lawyerName?.toLowerCase().includes(query) ?? false) ||
      r.taskId.toLowerCase().includes(query)

    const matchesStatus = statusFilter.value === 'all' || r.settlementStatus === statusFilter.value
    const matchesType = typeFilter.value === 'all' || r.taskType === typeFilter.value
    const matchesDirection =
      directionFilter.value === 'all' || r.direction === directionFilter.value

    return matchesSearch && matchesStatus && matchesType && matchesDirection
  })
})

function sumAmount(list: TaskSettlementRecord[]) {
  return list.reduce((sum, r) => sum + (r.agreedAmount ?? 0), 0)
}

const stats = computed(() => {
  const all = records.value
  const awaiting = all.filter((r) => r.settlementStatus === 'awaiting')
  const fulfilling = all.filter((r) => r.settlementStatus === 'fulfilling' || r.settlementStatus === 'disputed')
  const pendingSettlement = all.filter((r) => r.settlementStatus === 'pending_settlement')
  const settled = all.filter((r) => r.settlementStatus === 'settled')

  return {
    awaiting: { count: awaiting.length, amount: sumAmount(awaiting) },
    fulfilling: { count: fulfilling.length, amount: sumAmount(fulfilling) },
    pendingSettlement: { count: pendingSettlement.length, amount: sumAmount(pendingSettlement) },
    settled: { count: settled.length, amount: sumAmount(settled) },
    filteredAmount: sumAmount(filteredRecords.value),
  }
})

function formatAmount(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function directionPrefix(record: TaskSettlementRecord) {
  if (record.direction === 'income') return '+'
  return '-'
}

function directionClass(record: TaskSettlementRecord) {
  if (record.direction === 'income') return 'text-emerald-700'
  return 'text-[#fa8231]'
}

function openTask(record: TaskSettlementRecord) {
  const fromOrders = { query: { from: 'orders' } }
  if (isLawyer.value) {
    router.push({ name: 'my-task-detail', params: { id: record.taskId }, ...fromOrders })
    return
  }
  if (isPublisher.value || isAdmin.value) {
    router.push({ name: 'order-task-detail', params: { id: record.taskId } })
  }
}

function openTaskManagement() {
  router.push('/tasks')
}

function handleExportData() {
  if (!canManage.value) {
    alert('🔒 权限受限：您没有 [order_manage] 导出权限。')
    return
  }

  const subset = filteredRecords.value.map((r) => ({
    任务编号: r.taskId,
    任务标题: r.taskTitle,
    类型: r.taskType,
    地域: r.region,
    收支方向: r.direction === 'income' ? '收入' : '支出',
    发布方: r.publisherName,
    律师: r.lawyerName ?? '—',
    预算: r.budget,
    成交金额: r.agreedAmount,
    履约状态: SETTLEMENT_STATUS_LABELS[r.settlementStatus],
    任务状态: r.taskStatus,
    更新时间: r.updatedAt,
  }))

  exportedData.value = JSON.stringify(subset, null, 2)
  db.addLog(
    props.currentUser.username,
    currentRoleLabel.value,
    `导出收支履约数据 (${subset.length} 条)`,
    'OrderManage',
    'success',
  )
}

function handleCopyToClipboard() {
  if (!exportedData.value) return
  navigator.clipboard.writeText(exportedData.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 控制面板 -->
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2 w-full md:w-auto">
        <Wallet class="w-5 h-5 text-slate-800 shrink-0" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">{{ pageTitle }}</h2>
          <p class="text-[11px] text-slate-500">
            {{ pageSubtitle }} · 共 {{ records.length }} 条履约记录
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
        <div class="relative w-full sm:w-44 lg:w-56">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索任务/对方/编号..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all font-medium"
          />
        </div>

        <select
          v-model="statusFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部履约状态</option>
          <option value="awaiting">待锁定</option>
          <option value="fulfilling">履约中</option>
          <option value="pending_settlement">待结算</option>
          <option value="disputed">争议冻结</option>
          <option value="settled">已结算</option>
          <option value="closed">已关闭</option>
        </select>

        <select
          v-model="typeFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部任务类型</option>
          <option v-for="t in TASK_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>

        <select
          v-if="isAdmin"
          v-model="directionFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部方向</option>
          <option value="expense">支出（发布方）</option>
          <option value="income">收入（律师）</option>
        </select>

        <button
          class="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
          title="导出筛选结果"
          :disabled="!canManage"
          @click="handleExportData"
        >
          <FileSpreadsheet class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- 收支概览 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="item in [
          {
            label: '待锁定',
            count: stats.awaiting.count,
            amount: stats.awaiting.amount,
            color: 'text-amber-700',
            bg: 'bg-amber-50 border-amber-100',
            icon: TrendingDown,
          },
          {
            label: '履约中',
            count: stats.fulfilling.count,
            amount: stats.fulfilling.amount,
            color: 'text-blue-700',
            bg: 'bg-blue-50 border-blue-100',
            icon: TrendingDown,
          },
          {
            label: '待结算',
            count: stats.pendingSettlement.count,
            amount: stats.pendingSettlement.amount,
            color: 'text-violet-700',
            bg: 'bg-violet-50 border-violet-100',
            icon: TrendingDown,
          },
          {
            label: '已结算',
            count: stats.settled.count,
            amount: stats.settled.amount,
            color: 'text-emerald-700',
            bg: 'bg-emerald-50 border-emerald-100',
            icon: TrendingUp,
          },
        ]"
        :key="item.label"
        class="rounded-xl border p-3"
        :class="item.bg"
      >
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-medium text-slate-500">{{ item.label }}</span>
          <component :is="item.icon" class="w-3.5 h-3.5 opacity-50" :class="item.color" />
        </div>
        <span class="font-space font-bold text-xl mt-0.5 block" :class="item.color">{{ item.count }}</span>
        <span class="text-[10px] font-mono font-semibold mt-1 block" :class="item.color">
          {{ directionLabel }} {{ formatAmount(item.amount) }}
        </span>
      </div>
    </div>

    <!-- 筛选摘要 -->
    <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      <span class="bg-slate-100 px-2.5 py-1 rounded-full font-medium">
        当前筛选 {{ filteredRecords.length }} 条
      </span>
      <span
        class="px-2.5 py-1 rounded-full font-mono font-semibold border"
        :class="isLawyer ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-[#fa8231] border-orange-100'"
      >
        合计 {{ isLawyer ? '收入' : '支出' }} {{ formatAmount(stats.filteredAmount) }}
      </span>
      <button
        v-if="isPublisher && canManage"
        type="button"
        class="ml-auto text-[#fa8231] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
        @click="openTaskManagement"
      >
        前往任务发布管理
        <ArrowRight class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- 只读提示 -->
    <div v-if="!canManage" class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
      <Lock class="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
      <div>
        <h4 class="text-xs font-semibold text-slate-700">只读浏览模式</h4>
        <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          您缺少 <b>order_manage</b> 权限，可查看收支履约明细，但无法导出数据。任务验收与结算确认请在「任务发布管理」或任务详情中操作。
        </p>
      </div>
    </div>

    <!-- 履约说明 -->
    <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
      <span class="font-semibold text-slate-700">履约节点说明：</span>
      待锁定（任务待承接）→ 履约中（律师执行中）→ 待结算（交付待确认）→ 已结算（任务完成）。
      成交金额优先取中标报价，无报价时使用任务预算。
    </div>

    <!-- 数据表格 -->
    <div v-if="loading" class="py-16 text-center text-slate-400 text-sm bg-white border border-slate-100 rounded-2xl">
      加载履约数据中...
    </div>

    <div v-else class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse min-w-3xl">
        <thead>
          <tr class="border-b border-slate-150 text-slate-400 font-medium font-sans">
            <th class="py-3 px-2 w-[20%]">任务信息</th>
            <th class="py-3 px-2 w-[8%]">类型</th>
            <th v-if="isAdmin || isPublisher" class="py-3 px-2 w-[10%]">律师</th>
            <th v-if="isAdmin || isLawyer" class="py-3 px-2 w-[10%]">发布方</th>
            <th class="py-3 px-2 w-[8%] text-right">预算</th>
            <th class="py-3 px-2 w-[10%] text-right font-semibold">成交金额</th>
            <th class="py-3 px-2 w-[10%] text-center">履约状态</th>
            <th class="py-3 px-2 w-[10%]">更新时间</th>
            <th class="py-3 px-2 text-right w-[10%]">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50 text-slate-700 font-medium">
          <tr v-if="!filteredRecords.length">
            <td :colspan="isAdmin ? 9 : 8" class="py-12 text-center text-slate-400 font-medium">
              {{ isLawyer ? '暂无已承接任务的履约记录，前往任务大厅申请任务' : '暂无已发布任务的履约记录' }}
            </td>
          </tr>
          <tr
            v-for="r in filteredRecords"
            :key="r.id"
            class="hover:bg-slate-50/40 transition-colors"
            :class="r.settlementStatus === 'closed' ? 'bg-red-50/10' : ''"
          >
            <td class="py-3.5 px-2">
              <span class="font-bold text-slate-800 block truncate max-w-xs" :title="r.taskTitle">{{ r.taskTitle }}</span>
              <span class="font-mono text-[10px] text-slate-400 block mt-0.5">{{ r.taskId.slice(0, 12) }}…</span>
            </td>
            <td class="py-3.5 px-2">
              <span class="text-[11px] bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-sm">
                {{ r.taskType }}
              </span>
            </td>
            <td v-if="isAdmin || isPublisher" class="py-3.5 px-2">
              <span class="text-slate-700">{{ r.lawyerName ?? '—' }}</span>
            </td>
            <td v-if="isAdmin || isLawyer" class="py-3.5 px-2">
              <span class="text-slate-700">{{ r.publisherName }}</span>
            </td>
            <td class="py-3.5 px-2 text-right font-mono text-slate-500">{{ formatAmount(r.budget) }}</td>
            <td class="py-3.5 px-2 text-right">
              <span class="font-mono text-xs font-bold" :class="directionClass(r)">
                {{ directionPrefix(r) }}{{ formatAmount(r.agreedAmount) }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-center">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="SETTLEMENT_STATUS_CLASS[r.settlementStatus]"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="SETTLEMENT_STATUS_DOT_CLASS[r.settlementStatus]" />
                {{ SETTLEMENT_STATUS_LABELS[r.settlementStatus] }}
              </span>
            </td>
            <td class="py-3.5 px-2 font-mono text-[10px] text-slate-400">{{ formatDate(r.updatedAt) }}</td>
            <td class="py-3.5 px-2 text-right">
              <button
                type="button"
                class="px-2 py-1 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded text-[10px] font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                @click="openTask(r)"
              >
                <ExternalLink class="w-3 h-3" />
                查看任务
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 导出预览 -->
    <Transition name="fade">
      <div
        v-if="exportedData"
        class="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-left relative overflow-hidden"
      >
        <div class="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
          <span class="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <FileSpreadsheet class="w-4 h-4 text-[#fa8231]" />
            收支履约导出预览 (JSON)
          </span>
          <div class="flex items-center gap-2">
            <button
              class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md transition flex items-center gap-1 cursor-pointer"
              @click="handleCopyToClipboard"
            >
              <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" :class="copied ? 'text-emerald-400' : ''" />
              {{ copied ? '已复制' : '复制数据' }}
            </button>
            <button class="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer" @click="exportedData = null">
              <XCircle class="w-4 h-4" />
            </button>
          </div>
        </div>
        <pre class="text-[10px] overflow-auto max-h-48 leading-relaxed max-w-full">{{ exportedData }}</pre>
      </div>
    </Transition>
  </div>
</template>
