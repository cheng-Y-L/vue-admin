<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  ArrowRight,
  Activity,
  RefreshCw,
  Clock,
  PieChart,
  BarChart3,
  Filter,
  Eye,
  Calendar,
  Briefcase,
  FileText,
  Loader2,
} from '@lucide/vue'
import type { LucideIcon } from '@lucide/vue'
import { db } from '@/services/data'
import { fetchRecentSettlements } from '@/services/task-settlement.service'
import { fetchTaskStatsOverview } from '@/services/task-stats.service'
import { SETTLEMENT_STATUS_LABELS, SETTLEMENT_STATUS_CLASS } from '@/constants/settlements'
import { LEGACY_TAB_TO_PATH } from '@/router/nav'
import { roleLabel, roleHasPermission } from '@/constants/roles'
import { filterLogsForUser } from '@/utils/system-logs'
import type { User, SystemLog, TaskSettlementRecord, TaskStatsOverview } from '@/types'

const props = defineProps<{
  user: User
}>()

const router = useRouter()

const KPI_ICONS: LucideIcon[] = [Briefcase, FileText, Activity, DollarSign]
const KPI_COLORS = [
  'text-emerald-600 bg-emerald-50 border-emerald-100',
  'text-[#fa8231] bg-orange-50 border-orange-100',
  'text-blue-600 bg-blue-50 border-blue-100',
  'text-violet-600 bg-violet-50 border-violet-100',
]

function navigateTo(tabId: string) {
  const path = LEGACY_TAB_TO_PATH[tabId]
  if (path) router.push(path)
}

const stats = ref<TaskStatsOverview | null>(null)
const recentSettlements = ref<TaskSettlementRecord[]>([])
const recentLogs = ref<SystemLog[]>([])
const loading = ref(true)
const lastUpdated = ref('刚刚')

const activeChartPoint = ref<number | null>(null)
const hoveredType = ref<string | null>(null)
const activeBarIndex = ref<number | null>(null)
const activeFunnelIndex = ref<number | null>(null)

const canManageTasks = computed(() =>
  roleHasPermission(props.user.role, props.user.permissions, 'task_manage'),
)
const canBrowseTasks = computed(() =>
  roleHasPermission(props.user.role, props.user.permissions, 'task_browse'),
)

async function loadDashboardData() {
  loading.value = true
  const [overview, settlements] = await Promise.all([
    fetchTaskStatsOverview(props.user.id, props.user.role, '15d'),
    fetchRecentSettlements(props.user.id, props.user.role, 5),
  ])
  stats.value = overview
  recentSettlements.value = settlements
  recentLogs.value = filterLogsForUser(db.getLogs(), props.user).slice(0, 4)
  lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(loadDashboardData)

async function refreshData() {
  await loadDashboardData()
  db.addLog(
    props.user.username,
    roleLabel(props.user.role),
    '驾驶舱刷新任务统计数据',
    'TaskManage',
    'success',
  )
  recentLogs.value = filterLogsForUser(db.getLogs(), props.user).slice(0, 4)
}

const trend = computed(() => stats.value?.trend ?? [])
const typeDistribution = computed(() => stats.value?.typeDistribution ?? [])
const funnelSteps = computed(() => stats.value?.funnel ?? [])

// Line chart — published + completed
const width = 600
const height = 180

const selectedTrendPoint = computed(() => {
  if (!trend.value.length) return null
  if (activeChartPoint.value !== null) return trend.value[activeChartPoint.value]
  return trend.value[trend.value.length - 1]
})

const lineChartGeometry = computed(() => {
  const data = trend.value
  if (!data.length) return { points: [], linePath: '', areaPath: '', completedPath: '' }

  const maxVal = Math.max(...data.map((m) => Math.max(m.published, m.completed)), 1)
  const minVal = 0
  const maxDiff = maxVal - minVal || 1

  const points = data.map((m, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * (width - 40) + 20 : width / 2
    const y = height - ((m.published - minVal) / maxDiff) * (height - 45) - 15
    const yCompleted = height - ((m.completed - minVal) / maxDiff) * (height - 45) - 15
    return { x, y, yCompleted, ...m }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const completedPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yCompleted}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return { points, linePath, areaPath, completedPath }
})

const points = computed(() => lineChartGeometry.value.points)
const linePath = computed(() => lineChartGeometry.value.linePath)
const completedPath = computed(() => lineChartGeometry.value.completedPath)
const areaPath = computed(() => lineChartGeometry.value.areaPath)

// Donut chart
const totalTypeCount = computed(() =>
  typeDistribution.value.reduce((acc, curr) => acc + curr.count, 0),
)
const radius = 60
const circumference = 2 * Math.PI * radius

const donutSlices = computed(() => {
  const total = totalTypeCount.value || 1
  let accumulated = 0
  return typeDistribution.value.map((item) => {
    const percentage = item.count / total
    const strokeDash = `${percentage * circumference} ${circumference}`
    const strokeOffset = circumference - accumulated * circumference
    accumulated += percentage
    return { ...item, percentage, strokeDash, strokeOffset }
  })
})

const activeTypeData = computed(() =>
  hoveredType.value
    ? donutSlices.value.find((s) => s.label === hoveredType.value) ?? null
    : null,
)

// Dual bar chart — last 8 days
const barData = computed(() => trend.value.slice(-8))
const barSvgWidth = 540
const barSvgHeight = 180

const barChartScale = computed(() => {
  const data = barData.value
  if (!data.length) return { maxApps: 1, maxCompleted: 1, barSpacing: 60 }
  return {
    maxApps: Math.max(...data.map((d) => d.applications), 1),
    maxCompleted: Math.max(...data.map((d) => d.completed), 1),
    barSpacing: (barSvgWidth - 60) / data.length,
  }
})

function formatSettlementAmount(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden"
    >
      <div
        class="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient opacity-15 pointer-events-none"
      />
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div class="flex items-center gap-2">
            <span
              class="bg-slate-800/80 text-[#fa8231] text-xs font-semibold px-2.5 py-1 rounded-full border border-[#fa8231]/30"
            >
              {{
                user.role === 'admin'
                  ? '💎 超级系统管理员'
                  : user.role === 'publisher'
                    ? '✍️ 发布侧'
                    : '👁️ 律师'
              }}
            </span>
            <span class="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock class="w-3.5 h-3.5 text-slate-400" />
              数据最近更新: {{ lastUpdated }}
            </span>
          </div>
          <h1 class="font-space font-bold text-2xl mt-2">欢迎回来，{{ user.nickname }}!</h1>
          <p class="text-slate-400 text-xs mt-1">
            任务域驾驶舱：汇聚发布管理、任务大厅与我的任务的核心指标与履约动态。
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <button
            v-if="canManageTasks"
            type="button"
            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors cursor-pointer"
            @click="router.push('/tasks')"
          >
            任务发布管理
          </button>
          <button
            v-if="canBrowseTasks"
            type="button"
            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors cursor-pointer"
            @click="router.push('/task-hall')"
          >
            任务大厅
          </button>
          <button
            v-if="canBrowseTasks"
            type="button"
            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors cursor-pointer"
            @click="router.push('/my-tasks')"
          >
            我的任务
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-slate-850 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors flex items-center gap-1 cursor-pointer"
            @click="navigateTo('data_stats_view')"
          >
            <Eye class="w-3.5 h-3.5 text-[#fa8231]" />
            多维统计
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-[#fa8231] hover:bg-[#fa8231]/95 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            :disabled="loading"
            @click="refreshData"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            <RefreshCw v-else class="w-4 h-4" />
            刷新任务数据
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading && !stats" class="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
      <Loader2 class="w-5 h-5 animate-spin" />
      加载任务统计数据…
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="(item, index) in stats.summary.kpiCards"
          :key="index"
          class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">{{ item.title }}</span>
            <div :class="['p-2 rounded-xl border shrink-0', KPI_COLORS[index]]">
              <component :is="KPI_ICONS[index]" class="w-4 h-4" />
            </div>
          </div>
          <div class="mt-4">
            <span class="font-space font-bold text-2xl text-slate-900">{{ item.value }}</span>
            <div class="flex items-center gap-1.5 mt-2">
              <span
                v-if="item.change >= 0"
                class="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-0.5"
              >
                <TrendingUp class="w-3 h-3" />
                +{{ item.change }}%
              </span>
              <span
                v-else
                class="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-0.5"
              >
                <TrendingDown class="w-3 h-3" />
                {{ item.change }}%
              </span>
              <span class="text-[10px] text-slate-400">较上周期</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-2 flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between mb-2">
              <div>
                <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Activity class="w-4 h-4 text-orange-500" />
                  任务发布与完成趋势
                </h3>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  最近 15 天任务发布量与完成量波动，悬停查看具体节点
                </p>
              </div>
              <div class="flex gap-3 text-[10px] font-medium shrink-0">
                <span class="flex items-center gap-1 text-slate-600">
                  <span class="w-2 h-2 rounded bg-[#fa8231] inline-block" />
                  发布量
                </span>
                <span class="flex items-center gap-1 text-slate-600">
                  <span class="w-2 h-2 rounded bg-emerald-500 inline-block" />
                  完成量
                </span>
              </div>
            </div>
            <div class="relative pt-4">
              <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto overflow-visible select-none">
                <line x1="20" y1="15" :x2="width - 20" y2="15" stroke="#f1f5f9" stroke-dasharray="3 3" />
                <line x1="20" y1="80" :x2="width - 20" y2="80" stroke="#f1f5f9" stroke-dasharray="3 3" />
                <line x1="20" y1="145" :x2="width - 20" y2="145" stroke="#f1f5f9" stroke-dasharray="3 3" />
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#fa8231" stop-opacity="0.22" />
                    <stop offset="100%" stop-color="#fa8231" stop-opacity="0.01" />
                  </linearGradient>
                </defs>
                <path :d="areaPath" fill="url(#salesGrad)" />
                <path :d="linePath" fill="none" stroke="#fa8231" stroke-width="2.5" stroke-linecap="round" />
                <path
                  :d="completedPath"
                  fill="none"
                  stroke="#10b981"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-dasharray="4 3"
                />
                <g v-for="(p, i) in points" :key="i" class="cursor-pointer">
                  <line
                    v-if="activeChartPoint === i"
                    :x1="p.x"
                    y1="15"
                    :x2="p.x"
                    :y2="height"
                    stroke="#fa8231"
                    stroke-width="1"
                    stroke-dasharray="2 2"
                  />
                  <circle v-if="activeChartPoint === i" :cx="p.x" :cy="p.y" r="6" fill="#fa8231" />
                  <circle
                    :cx="p.x"
                    :cy="p.y"
                    r="3"
                    :fill="activeChartPoint === i ? '#ffffff' : '#fa8231'"
                    stroke="#fa8231"
                    stroke-width="1.5"
                  />
                  <rect
                    :x="p.x - 15"
                    y="0"
                    width="30"
                    :height="height"
                    fill="transparent"
                    @mouseenter="activeChartPoint = i"
                    @mouseleave="activeChartPoint = null"
                  />
                </g>
                <text
                  v-for="(p, i) in points.filter((_, idx) => idx % 2 === 0)"
                  :key="`tick-${i}`"
                  :x="p.x"
                  :y="height + 15"
                  text-anchor="middle"
                  fill="#94a3b8"
                  font-size="10"
                  font-family="monospace"
                >
                  {{ p.date }}
                </text>
              </svg>
            </div>
          </div>
          <div
            v-if="selectedTrendPoint"
            class="grid grid-cols-3 gap-2 mt-6 bg-slate-50 border border-slate-100 rounded-xl p-3"
          >
            <div class="text-center">
              <span class="text-[10px] text-slate-500 block">节点日期</span>
              <span class="text-xs font-mono font-bold text-slate-900">{{ selectedTrendPoint.date }}</span>
            </div>
            <div class="text-center border-x border-slate-200">
              <span class="text-[10px] text-slate-500 block">发布 / 完成</span>
              <span class="text-xs font-mono font-bold text-[#fa8231]">
                {{ selectedTrendPoint.published }} / {{ selectedTrendPoint.completed }}
              </span>
            </div>
            <div class="text-center">
              <span class="text-[10px] text-slate-500 block">申请 / 预算</span>
              <span class="text-xs font-mono font-bold text-slate-900">
                {{ selectedTrendPoint.applications }} 条 / ¥{{ selectedTrendPoint.budgetAmount.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>

        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
              <PieChart class="w-4 h-4 text-indigo-500" />
              任务类型分布
            </h3>
            <p class="text-[11px] text-slate-500 mt-0.5">按案件类型统计任务数量与预算占比</p>
          </div>
          <div v-if="!typeDistribution.length" class="py-8 text-center text-slate-400 text-xs">
            暂无任务类型数据
          </div>
          <template v-else>
            <div class="flex flex-col items-center justify-center my-4 relative">
              <div class="relative w-[130px] h-[130px]">
                <svg viewBox="0 0 150 150" class="w-full h-full -rotate-90">
                  <circle
                    v-for="(slice, index) in donutSlices"
                    :key="index"
                    cx="75"
                    cy="75"
                    :r="radius"
                    fill="none"
                    :stroke="slice.color"
                    :stroke-width="hoveredType === slice.label ? 16 : 10"
                    :stroke-dasharray="slice.strokeDash"
                    :stroke-dashoffset="slice.strokeOffset"
                    class="transition-all duration-300 cursor-pointer"
                    @mouseenter="hoveredType = slice.label"
                    @mouseleave="hoveredType = null"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span class="text-[9px] text-slate-400 font-medium">
                    {{ activeTypeData ? activeTypeData.label : '任务类型' }}
                  </span>
                  <span class="text-sm font-bold font-mono text-slate-800">
                    {{ activeTypeData ? `${activeTypeData.count} 个` : `${totalTypeCount} 个` }}
                  </span>
                  <span class="text-[9px] text-emerald-600 font-mono font-semibold">
                    {{
                      activeTypeData
                        ? `${(activeTypeData.percentage * 100).toFixed(1)}%`
                        : '100%'
                    }}
                  </span>
                </div>
              </div>
            </div>
            <div class="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              <div
                v-for="(item, i) in donutSlices"
                :key="i"
                class="flex items-center justify-between text-[11px] p-1.5 rounded transition-all cursor-pointer"
                :class="hoveredType === item.label ? 'bg-slate-50 border-l-2' : 'hover:bg-slate-50/50'"
                :style="{ borderLeftColor: hoveredType === item.label ? item.color : 'transparent' }"
                @mouseenter="hoveredType = item.label"
                @mouseleave="hoveredType = null"
              >
                <div class="flex items-center gap-2 truncate max-w-[65%]">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
                  <span class="text-slate-700 font-medium truncate">{{ item.label }}</span>
                </div>
                <div class="font-mono text-slate-500 shrink-0 text-right">
                  {{ item.count }} 个 ({{ (item.percentage * 100).toFixed(1) }}%)
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 class="w-4 h-4 text-emerald-500" />
                  申请量 / 完成量双柱对比
                </h3>
                <p class="text-[11px] text-slate-500 mt-0.5">最近 8 日律师申请与任务完成关联趋势</p>
              </div>
              <div class="flex gap-2 text-[10px] font-medium shrink-0">
                <span class="flex items-center gap-1 text-slate-600">
                  <span class="w-2 h-2 rounded bg-indigo-500 inline-block" />
                  申请量
                </span>
                <span class="flex items-center gap-1 text-slate-600">
                  <span class="w-2 h-2 rounded bg-emerald-500 inline-block" />
                  完成量
                </span>
              </div>
            </div>
            <div v-if="!barData.length" class="py-8 text-center text-slate-400 text-xs">暂无趋势数据</div>
            <div v-else class="relative pt-6">
              <svg :viewBox="`0 0 ${barSvgWidth} ${barSvgHeight}`" class="w-full h-auto overflow-visible select-none">
                <line x1="30" y1="20" :x2="barSvgWidth - 10" y2="20" stroke="#f1f5f9" stroke-dasharray="3 3" />
                <line x1="30" y1="70" :x2="barSvgWidth - 10" y2="70" stroke="#f1f5f9" stroke-dasharray="3 3" />
                <line x1="30" y1="120" :x2="barSvgWidth - 10" y2="120" stroke="#f1f5f9" stroke-dasharray="3 3" />
                <line x1="30" y1="150" :x2="barSvgWidth - 10" y2="150" stroke="#f1f5f9" />
                <g v-for="(d, index) in barData" :key="`bar-${index}`">
                  <rect
                    :x="40 + index * barChartScale.barSpacing - 15"
                    y="10"
                    :width="barChartScale.barSpacing - 6"
                    height="145"
                    :fill="activeBarIndex === index ? 'rgba(79, 70, 229, 0.03)' : 'transparent'"
                    rx="8"
                    class="cursor-pointer"
                    @mouseenter="activeBarIndex = index"
                    @mouseleave="activeBarIndex = null"
                  />
                  <rect
                    :x="40 + index * barChartScale.barSpacing - 10"
                    :y="150 - (d.applications / barChartScale.maxApps) * 115"
                    width="8"
                    :height="Math.max((d.applications / barChartScale.maxApps) * 115, 2)"
                    :fill="activeBarIndex === index ? '#6366f1' : '#818cf8'"
                    rx="2"
                  />
                  <rect
                    :x="40 + index * barChartScale.barSpacing + 1"
                    :y="150 - (d.completed / barChartScale.maxCompleted) * 105"
                    width="8"
                    :height="Math.max((d.completed / barChartScale.maxCompleted) * 105, 2)"
                    :fill="activeBarIndex === index ? '#059669' : '#34d399'"
                    rx="2"
                  />
                  <text
                    :x="40 + index * barChartScale.barSpacing - 1"
                    y="167"
                    text-anchor="middle"
                    :fill="activeBarIndex === index ? '#000' : '#475569'"
                    font-size="9"
                    class="font-mono"
                  >
                    {{ d.date }}
                  </text>
                </g>
              </svg>
            </div>
          </div>
          <div class="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-2 px-3 flex justify-between items-center min-h-11 text-xs">
            <template v-if="activeBarIndex !== null && barData[activeBarIndex]">
              <span class="font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar class="w-3.5 h-3.5 text-slate-400" />
                {{ barData[activeBarIndex].date }}
              </span>
              <span class="text-indigo-600 font-mono font-medium">
                申请: <b>{{ barData[activeBarIndex].applications }} 条</b>
              </span>
              <span class="text-emerald-700 font-mono font-medium">
                完成: <b>{{ barData[activeBarIndex].completed }} 个</b>
              </span>
            </template>
            <span v-else class="text-slate-400 mx-auto text-[11px]">悬停柱状图查看当日申请与完成数据</span>
          </div>
        </div>

        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
              <Filter class="w-4 h-4 text-orange-500" />
              任务生命周期漏斗
            </h3>
            <p class="text-[11px] text-slate-500 mt-0.5">从发布到完成的闭环转化，诊断任务流失环节</p>
          </div>
          <div class="space-y-2.5 my-3 relative">
            <div
              v-for="(step, index) in funnelSteps"
              :key="index"
              class="relative p-2.5 rounded-xl border transition-all duration-200 cursor-pointer"
              :class="
                activeFunnelIndex === index
                  ? 'bg-slate-50 border-slate-200 scale-[1.01]'
                  : 'bg-white border-slate-100 hover:bg-slate-50/40'
              "
              @mouseenter="activeFunnelIndex = index"
              @mouseleave="activeFunnelIndex = null"
            >
              <div
                class="absolute inset-y-0 left-0 bg-slate-50 border-r border-slate-100 rounded-l-xl opacity-30 pointer-events-none"
                :style="{ width: `${step.rate}%` }"
              />
              <div class="flex justify-between items-center relative z-10">
                <div class="flex items-center gap-2.5">
                  <span
                    class="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center font-mono shrink-0"
                    :style="{ backgroundColor: step.color }"
                  >
                    {{ index + 1 }}
                  </span>
                  <div class="min-w-0">
                    <span class="text-xs font-semibold text-slate-800 block leading-tight">{{ step.name }}</span>
                    <span class="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[240px]">{{ step.desc }}</span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-xs font-bold font-mono text-slate-900 block">{{ step.value }}</span>
                  <span class="text-[10px] text-slate-500 font-medium">漏斗比: {{ step.rate }}%</span>
                </div>
              </div>
              <div
                v-if="index < funnelSteps.length - 1 && step.rate > 0"
                class="absolute -bottom-2 right-12 z-20 bg-slate-900 text-slate-100 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold scale-90 pointer-events-none"
              >
                转化率: {{ ((funnelSteps[index + 1].rate / step.rate) * 100).toFixed(1) }}% ↓
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShoppingBag class="w-4 h-4 text-[#fa8231]" />
            最新收支履约
          </h3>
          <button
            type="button"
            class="text-[11px] font-semibold text-[#fa8231] hover:underline flex items-center gap-0.5 cursor-pointer"
            @click="navigateTo('order_manage')"
          >
            履约详情
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="divide-y divide-slate-100">
          <div v-if="recentSettlements.length === 0" class="py-6 text-center text-slate-400 text-xs">
            暂无履约记录
          </div>
          <div
            v-for="item in recentSettlements"
            v-else
            :key="item.id"
            class="py-3 flex items-center justify-between gap-2 hover:bg-slate-50/40 px-1 rounded-sm transition-colors"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-900 truncate">{{ item.taskTitle }}</span>
                <span
                  :class="[
                    'px-1.5 py-0.5 rounded-sm text-[10px] font-semibold',
                    SETTLEMENT_STATUS_CLASS[item.settlementStatus],
                  ]"
                >
                  {{ SETTLEMENT_STATUS_LABELS[item.settlementStatus] }}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 truncate mt-0.5">{{ item.taskType }} · {{ item.region }}</p>
            </div>
            <div class="text-right shrink-0">
              <span
                class="font-mono text-xs font-bold block"
                :class="item.direction === 'income' ? 'text-emerald-700' : 'text-[#fa8231]'"
              >
                {{ item.direction === 'income' ? '+' : '-' }}{{ formatSettlementAmount(item.agreedAmount) }}
              </span>
              <span class="text-[10px] text-slate-400 font-mono">
                {{ item.updatedAt.replace('T', ' ').slice(5, 16) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
            <Activity class="w-4 h-4 text-slate-800" />
            审计操作日志{{ user.role === 'admin' ? '' : '（仅本人）' }}
          </h3>
          <button
            type="button"
            class="text-[11px] font-semibold text-[#fa8231] hover:underline flex items-center gap-0.5 cursor-pointer"
            @click="navigateTo('system_logs_view')"
          >
            日志核对
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="space-y-4">
          <div v-if="recentLogs.length === 0" class="py-6 text-center text-slate-400 text-xs">暂无操作日志</div>
          <div v-for="(log, idx) in recentLogs" v-else :key="idx" class="flex gap-3 text-xs leading-relaxed">
            <div class="relative flex flex-col items-center">
              <div
                :class="[
                  'w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 z-10',
                  log.status === 'success' ? 'bg-slate-950' : 'bg-red-500',
                ]"
              />
              <div v-if="idx !== recentLogs.length - 1" class="w-0.5 bg-slate-100 flex-1 my-1.5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-900 font-mono">@{{ log.operator }} ({{ log.role }})</span>
                <span class="text-[10px] font-mono text-slate-400">{{ log.timestamp.substring(11, 19) }}</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">{{ log.action }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
