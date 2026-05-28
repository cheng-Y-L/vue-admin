<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  BarChart3,
  PieChart,
  DollarSign,
  TrendingUp,
  Briefcase,
  FileText,
  Loader2,
  ArrowRight,
  MapPin,
  Layers,
  ListChecks,
} from '@lucide/vue'
import { fetchTaskStatsOverview, type TaskStatsRange } from '@/services/task-stats.service'
import { roleHasPermission } from '@/constants/roles'
import type { User, TaskStatsOverview, TaskStatsDistribution } from '@/types'

const props = defineProps<{ user: User }>()

const router = useRouter()

type ChartMode = 'tasks' | 'budget' | 'applications'
type DistributionTab = 'type' | 'status' | 'region'

const timeRange = ref<TaskStatsRange>('15d')
const chartMode = ref<ChartMode>('tasks')
const distributionTab = ref<DistributionTab>('type')
const hoveredLabel = ref<string | null>(null)
const loading = ref(true)
const stats = ref<TaskStatsOverview | null>(null)

const canManageTasks = computed(() =>
  roleHasPermission(props.user.role, props.user.permissions, 'task_manage'),
)
const canBrowseTasks = computed(() =>
  roleHasPermission(props.user.role, props.user.permissions, 'task_browse'),
)

async function loadStats() {
  loading.value = true
  stats.value = await fetchTaskStatsOverview(props.user.id, props.user.role, timeRange.value)
  loading.value = false
}

onMounted(loadStats)
watch(timeRange, loadStats)

const trend = computed(() => stats.value?.trend ?? [])

const chartModeLabel = computed(() => {
  if (chartMode.value === 'tasks') return '任务发布量'
  if (chartMode.value === 'budget') return '预算金额 (CNY)'
  return '律师申请量'
})

function trendValue(point: (typeof trend.value)[0]): number {
  if (chartMode.value === 'tasks') return point.published
  if (chartMode.value === 'budget') return point.budgetAmount
  return point.applications
}

const filteredMetrics = computed(() => trend.value)

const maxVal = computed(() =>
  Math.max(...filteredMetrics.value.map((m) => trendValue(m)), 1),
)
const minVal = computed(() => Math.min(...filteredMetrics.value.map((m) => trendValue(m)), 0))
const valueDelta = computed(() => maxVal.value - minVal.value || 1)

const width = 640
const height = 240
const paddingX = 40
const paddingY = 30

const chartPoints = computed(() => {
  const data = filteredMetrics.value
  if (!data.length) return []
  return data.map((m, i) => {
    const val = trendValue(m)
    const x = data.length > 1 ? paddingX + (i / (data.length - 1)) * (width - paddingX * 2) : width / 2
    const y = height - paddingY - ((val - minVal.value) / valueDelta.value) * (height - paddingY * 2)
    return { x, y, val, ...m }
  })
})

const lineString = computed(() =>
  chartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '),
)

const fillAreaString = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  return `${lineString.value} L ${pts[pts.length - 1].x} ${height - paddingY} L ${pts[0].x} ${height - paddingY} Z`
})

const activeDistribution = computed((): TaskStatsDistribution[] => {
  if (!stats.value) return []
  if (distributionTab.value === 'type') return stats.value.typeDistribution
  if (distributionTab.value === 'status') return stats.value.statusDistribution
  return stats.value.regionDistribution
})

const totalDistributionCount = computed(() =>
  activeDistribution.value.reduce((sum, d) => sum + d.count, 0),
)

function donutOffset(index: number) {
  const total = totalDistributionCount.value || 1
  let accumulated = 0
  for (let i = 0; i < index; i++) {
    accumulated += (activeDistribution.value[i].count / total) * 100
  }
  return (188.4 * (100 - accumulated)) / 100
}

const insightCards = computed(() => {
  const insights = stats.value?.insights ?? []
  const styles = [
    { bg: 'bg-emerald-50/60 border-emerald-100/50', title: 'text-emerald-800', body: 'text-emerald-700' },
    { bg: 'bg-amber-50/60 border-amber-100/50', title: 'text-amber-800', body: 'text-amber-700' },
    { bg: 'bg-blue-50/60 border-blue-100/50', title: 'text-blue-800', body: 'text-blue-700' },
    { bg: 'bg-violet-50/60 border-violet-100/50', title: 'text-violet-800', body: 'text-violet-700' },
  ]
  return insights.map((text, i) => ({ text, style: styles[i % styles.length] }))
})
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <BarChart3 class="w-5 h-5 text-slate-800" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">任务域多维统计</h2>
          <p class="text-[11px] text-slate-500">整合发布管理、任务大厅与我的任务的聚合分析</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="bg-slate-100 p-1 rounded-lg flex text-xs font-semibold">
          <button
            v-for="btn in [
              { id: 'tasks', label: '任务量' },
              { id: 'budget', label: '预算金额' },
              { id: 'applications', label: '申请量' },
            ]"
            :key="btn.id"
            class="px-3 py-1.5 rounded-md transition-all cursor-pointer"
            :class="chartMode === btn.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-950'"
            @click="chartMode = btn.id as ChartMode"
          >
            {{ btn.label }}
          </button>
        </div>
        <div class="bg-slate-100 p-1 rounded-lg flex text-xs font-semibold">
          <button
            class="px-3 py-1.5 rounded-md transition-all cursor-pointer"
            :class="timeRange === '7d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'"
            @click="timeRange = '7d'"
          >
            7天
          </button>
          <button
            class="px-3 py-1.5 rounded-md transition-all cursor-pointer"
            :class="timeRange === '15d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'"
            @click="timeRange = '15d'"
          >
            15天
          </button>
          <button
            class="px-3 py-1.5 rounded-md transition-all cursor-pointer"
            :class="timeRange === '30d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'"
            @click="timeRange = '30d'"
          >
            30天
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading && !stats" class="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
      <Loader2 class="w-5 h-5 animate-spin" />
      加载统计数据…
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <span class="text-[11px] text-slate-500 block font-medium">周期内发布任务</span>
          <div class="flex items-center justify-between mt-2">
            <span class="font-space font-bold text-2xl text-[#fa8231]">{{ stats.summary.totalPublished }} 个</span>
            <div class="p-1.5 bg-orange-50 rounded-lg">
              <Briefcase class="w-4 h-4 text-[#fa8231]" />
            </div>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <span class="text-[11px] text-slate-500 block font-medium">周期内申请 / 完成</span>
          <div class="flex items-center justify-between mt-2">
            <span class="font-space font-bold text-2xl text-slate-900">
              {{ stats.summary.totalApplications }} / {{ stats.summary.totalCompleted }}
            </span>
            <div class="p-1.5 bg-slate-50 rounded-lg">
              <FileText class="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <span class="text-[11px] text-slate-500 block font-medium">预算合计 / 已结算</span>
          <div class="flex items-center justify-between mt-2">
            <span class="font-space font-bold text-2xl text-blue-600">
              ¥{{ stats.summary.totalBudgetAmount.toLocaleString() }}
            </span>
            <div class="p-1.5 bg-blue-50 rounded-lg">
              <DollarSign class="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p class="text-[10px] text-emerald-600 mt-1 font-medium">
            已结算 ¥{{ stats.summary.totalSettledAmount.toLocaleString() }}
          </p>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
              <TrendingUp class="w-4 h-4 text-slate-800" />
              任务运行趋势
            </h3>
            <p class="text-[11px] text-slate-500">
              数据周期：{{ timeRange === '7d' ? '7天' : timeRange === '15d' ? '15天' : '30天' }} · {{ chartModeLabel }}
            </p>
          </div>
          <span class="text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold">● 实时聚合</span>
        </div>
        <div v-if="!chartPoints.length" class="py-12 text-center text-slate-400 text-xs">暂无趋势数据</div>
        <svg v-else :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto overflow-visible select-none">
          <g v-for="(ratio, idx) in [0, 0.25, 0.5, 0.75, 1]" :key="idx">
            <line
              :x1="paddingX"
              :y1="paddingY + ratio * (height - paddingY * 2)"
              :x2="width - paddingX"
              :y2="paddingY + ratio * (height - paddingY * 2)"
              stroke="#f1f5f9"
              stroke-dasharray="3 3"
            />
          </g>
          <path :d="fillAreaString" fill="url(#statsChartGrad)" />
          <path :d="lineString" fill="none" stroke="#fa8231" stroke-width="2.5" stroke-linecap="round" />
          <circle v-for="(p, i) in chartPoints" :key="i" :cx="p.x" :cy="p.y" r="4" fill="#fa8231" />
          <text
            v-for="(p, i) in chartPoints"
            v-show="timeRange === '7d' || i % 2 === 0"
            :key="'t' + i"
            :x="p.x"
            :y="height - 10"
            text-anchor="middle"
            fill="#94a3b8"
            font-size="9"
          >
            {{ p.date }}
          </text>
          <defs>
            <linearGradient id="statsChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fa8231" stop-opacity="0.15" />
              <stop offset="100%" stop-color="#fa8231" stop-opacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <div class="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <PieChart class="w-4 h-4" />
                多维分布分析
              </h3>
            </div>
            <div class="bg-slate-100 p-0.5 rounded-md flex text-[10px] font-bold">
              <button
                class="px-2 py-1 rounded flex items-center gap-1"
                :class="distributionTab === 'type' ? 'bg-white shadow-xs' : ''"
                @click="distributionTab = 'type'"
              >
                <Layers class="w-3 h-3" />
                类型
              </button>
              <button
                class="px-2 py-1 rounded flex items-center gap-1"
                :class="distributionTab === 'status' ? 'bg-white shadow-xs' : ''"
                @click="distributionTab = 'status'"
              >
                <ListChecks class="w-3 h-3" />
                状态
              </button>
              <button
                class="px-2 py-1 rounded flex items-center gap-1"
                :class="distributionTab === 'region' ? 'bg-white shadow-xs' : ''"
                @click="distributionTab = 'region'"
              >
                <MapPin class="w-3 h-3" />
                地域
              </button>
            </div>
          </div>
          <div v-if="!activeDistribution.length" class="py-8 text-center text-slate-400 text-xs">暂无分布数据</div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
            <div class="relative flex justify-center">
              <svg width="150" height="150" viewBox="0 0 100 100" class="transform -rotate-90">
                <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f1f5f9" stroke-width="12" />
                <circle
                  v-for="(c, i) in activeDistribution"
                  :key="i"
                  cx="50"
                  cy="50"
                  r="30"
                  fill="transparent"
                  :stroke="c.color"
                  stroke-width="12"
                  stroke-dasharray="188.4"
                  :stroke-dashoffset="donutOffset(i)"
                  :style="{ opacity: hoveredLabel === null || hoveredLabel === c.label ? 1 : 0.4 }"
                  @mouseenter="hoveredLabel = c.label"
                  @mouseleave="hoveredLabel = null"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span class="text-[9px] text-slate-400">{{ hoveredLabel ?? '合计' }}</span>
                <span class="text-sm font-bold font-mono text-slate-800">
                  {{
                    hoveredLabel
                      ? activeDistribution.find((d) => d.label === hoveredLabel)?.count ?? 0
                      : totalDistributionCount
                  }}
                  个
                </span>
              </div>
            </div>
            <div class="space-y-1.5 max-h-[180px] overflow-y-auto">
              <div
                v-for="(c, i) in activeDistribution"
                :key="i"
                class="flex items-center justify-between text-xs p-1 rounded-sm cursor-pointer"
                :class="hoveredLabel === c.label ? 'bg-slate-50 font-semibold' : ''"
                @mouseenter="hoveredLabel = c.label"
                @mouseleave="hoveredLabel = null"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: c.color }" />
                  <span class="truncate">{{ c.label }}</span>
                </div>
                <span class="font-mono font-semibold shrink-0 ml-2">
                  {{ totalDistributionCount ? ((c.count / totalDistributionCount) * 100).toFixed(1) : 0 }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-1.5 mb-4">
            运营诊断与建议
          </h3>
          <div class="space-y-3.5 text-xs">
            <div
              v-for="(card, i) in insightCards"
              :key="i"
              class="p-3 rounded-xl border"
              :class="card.style.bg"
            >
              <span class="font-bold block" :class="card.style.title">💡 洞察 {{ i + 1 }}</span>
              <p class="text-[11px] mt-1" :class="card.style.body">{{ card.text }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          v-if="canManageTasks"
          type="button"
          class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-left hover:border-[#fa8231]/30 hover:bg-orange-50/30 transition-all cursor-pointer group"
          @click="router.push('/tasks')"
        >
          <div class="flex items-center justify-between">
            <Briefcase class="w-5 h-5 text-[#fa8231]" />
            <ArrowRight class="w-4 h-4 text-slate-300 group-hover:text-[#fa8231] transition-colors" />
          </div>
          <h4 class="font-space font-bold text-sm text-slate-900 mt-3">任务发布管理</h4>
          <p class="text-[11px] text-slate-500 mt-1">发布、审核申请与交付确认</p>
        </button>
        <button
          v-if="canBrowseTasks"
          type="button"
          class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-left hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group"
          @click="router.push('/task-hall')"
        >
          <div class="flex items-center justify-between">
            <Layers class="w-5 h-5 text-blue-600" />
            <ArrowRight class="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
          </div>
          <h4 class="font-space font-bold text-sm text-slate-900 mt-3">任务大厅</h4>
          <p class="text-[11px] text-slate-500 mt-1">浏览开放任务并提交承接申请</p>
        </button>
        <button
          v-if="canBrowseTasks"
          type="button"
          class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-left hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer group"
          @click="router.push('/my-tasks')"
        >
          <div class="flex items-center justify-between">
            <FileText class="w-5 h-5 text-emerald-600" />
            <ArrowRight class="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
          </div>
          <h4 class="font-space font-bold text-sm text-slate-900 mt-3">我的任务</h4>
          <p class="text-[11px] text-slate-500 mt-1">管理申请、进行中与历史任务</p>
        </button>
      </div>
    </template>
  </div>
</template>
