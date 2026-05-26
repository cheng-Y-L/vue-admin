<script setup lang="ts">
import { ref, computed } from 'vue'
import { BarChart3, PieChart, Calendar, DollarSign, Percent, TrendingUp, ShoppingCart } from '@lucide/vue'
import { METRIC_HISTORY, CATEGORY_RATIOS } from '../services/data'

type ChartMode = 'sales' | 'visitors' | 'orders'

const timeRange = ref<'15d' | '7d'>('15d')
const chartMode = ref<ChartMode>('sales')
const selectedSubTab = ref<'categories' | 'payments'>('categories')
const hoveredCategory = ref<string | null>(null)

const filteredMetrics = computed(() =>
  timeRange.value === '15d' ? METRIC_HISTORY : METRIC_HISTORY.slice(-7),
)

const maxVal = computed(() => Math.max(...filteredMetrics.value.map((m) => m[chartMode.value])))
const minVal = computed(() => Math.min(...filteredMetrics.value.map((m) => m[chartMode.value])))
const valueDelta = computed(() => maxVal.value - minVal.value || 1)

const width = 640
const height = 240
const paddingX = 40
const paddingY = 30

const chartPoints = computed(() =>
  filteredMetrics.value.map((m, i) => {
    const x = paddingX + (i / (filteredMetrics.value.length - 1)) * (width - paddingX * 2)
    const y = height - paddingY - ((m[chartMode.value] - minVal.value) / valueDelta.value) * (height - paddingY * 2)
    return { x, y, ...m }
  }),
)

const lineString = computed(() =>
  chartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '),
)

const fillAreaString = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  return `${lineString.value} L ${pts[pts.length - 1].x} ${height - paddingY} L ${pts[0].x} ${height - paddingY} Z`
})

const totalSales = computed(() => filteredMetrics.value.reduce((sum, m) => sum + m.sales, 0))
const totalOrders = computed(() => filteredMetrics.value.reduce((sum, m) => sum + m.orders, 0))
const totalUv = computed(() => filteredMetrics.value.reduce((sum, m) => sum + m.visitors, 0))
const totalCategorySales = computed(() => CATEGORY_RATIOS.reduce((sum, c) => sum + c.sales, 0))

const paymentMethods = [
  { name: '支付宝 Alipay', count: 35, percentage: 42, color: '#3b82f6' },
  { name: '微信支付 WeChatPay', count: 28, percentage: 33, color: '#10b981' },
  { name: '信用卡 CreditCard', count: 15, percentage: 18, color: '#f59e0b' },
  { name: '贝宝 PayPal', count: 6, percentage: 7, color: '#8b5cf6' },
]

const chartModeLabel = computed(() => {
  if (chartMode.value === 'sales') return '销售营业总额 (CNY)'
  if (chartMode.value === 'orders') return '履约妥投结算量'
  return '访客承载量 UV'
})

function donutOffset(index: number) {
  let accumulated = 0
  for (let i = 0; i < index; i++) {
    accumulated += (CATEGORY_RATIOS[i].sales / totalCategorySales.value) * 100
  }
  return (188.4 * (100 - accumulated)) / 100
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <BarChart3 class="w-5 h-5 text-slate-800" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">数据与综合统计图表</h2>
          <p class="text-[11px] text-slate-500">业务层成单转化、渠道占比的多维核算体系</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="bg-slate-100 p-1 rounded-lg flex text-xs font-semibold">
          <button
            v-for="btn in [
              { id: 'sales', label: '营业总额 (¥)' },
              { id: 'orders', label: '结算量 (单)' },
              { id: 'visitors', label: 'UV流量指数' },
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
          <button class="px-3 py-1.5 rounded-md transition-all cursor-pointer" :class="timeRange === '15d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'" @click="timeRange = '15d'">15天趋势</button>
          <button class="px-3 py-1.5 rounded-md transition-all cursor-pointer" :class="timeRange === '7d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'" @click="timeRange = '7d'">7天趋势</button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="(stat, i) in [
        { label: '统计周期营业额', value: `¥${totalSales.toLocaleString()}`, accent: 'text-[#fa8231]', icon: DollarSign },
        { label: '成交支付确认量', value: `${totalOrders} 单`, accent: 'text-slate-900', icon: ShoppingCart },
        { label: '总访客指数 (UV)', value: `${totalUv.toLocaleString()} 人`, accent: 'text-blue-600', icon: Calendar },
      ]" :key="i" class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <span class="text-[11px] text-slate-500 block font-medium">{{ stat.label }}</span>
        <div class="flex items-center justify-between mt-2">
          <span class="font-space font-bold text-2xl" :class="stat.accent">{{ stat.value }}</span>
          <div class="p-1.5 bg-slate-50 rounded-lg">
            <component :is="stat.icon" class="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
            <TrendingUp class="w-4 h-4 text-slate-800" /> 历史运行矢量波动图
          </h3>
          <p class="text-[11px] text-slate-500">数据周期：{{ timeRange === '15d' ? '15天全景' : '7天核实' }} · {{ chartModeLabel }}</p>
        </div>
        <span class="text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold">● 活跃指标统计</span>
      </div>
      <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto overflow-visible select-none">
        <g v-for="(ratio, idx) in [0, 0.25, 0.5, 0.75, 1]" :key="idx">
          <line :x1="paddingX" :y1="paddingY + ratio * (height - paddingY * 2)" :x2="width - paddingX" :y2="paddingY + ratio * (height - paddingY * 2)" stroke="#f1f5f9" stroke-dasharray="3 3" />
        </g>
        <path :d="fillAreaString" fill="url(#statsChartGrad)" />
        <path :d="lineString" fill="none" stroke="#fa8231" stroke-width="2.5" stroke-linecap="round" />
        <circle v-for="(p, i) in chartPoints" :key="i" :cx="p.x" :cy="p.y" r="4" fill="#fa8231" />
        <text v-for="(p, i) in chartPoints" v-show="timeRange !== '15d' || i % 2 === 0" :key="'t'+i" :x="p.x" :y="height - 10" text-anchor="middle" fill="#94a3b8" font-size="9">{{ p.date }}</text>
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
              <PieChart class="w-4 h-4" /> 主配品类成交占比
            </h3>
          </div>
          <div class="bg-slate-100 p-0.5 rounded-md flex text-[10px] font-bold">
            <button class="px-2 py-1 rounded" :class="selectedSubTab === 'categories' ? 'bg-white shadow-xs' : ''" @click="selectedSubTab = 'categories'">类目</button>
            <button class="px-2 py-1 rounded" :class="selectedSubTab === 'payments' ? 'bg-white shadow-xs' : ''" @click="selectedSubTab = 'payments'">通道</button>
          </div>
        </div>
        <div v-if="selectedSubTab === 'categories'" class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
          <div class="relative flex justify-center">
            <svg width="150" height="150" viewBox="0 0 100 100" class="transform -rotate-90">
              <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f1f5f9" stroke-width="12" />
              <circle
                v-for="(c, i) in CATEGORY_RATIOS"
                :key="i"
                cx="50" cy="50" r="30" fill="transparent" :stroke="c.color" stroke-width="12"
                stroke-dasharray="188.4"
                :stroke-dashoffset="donutOffset(i)"
                :style="{ opacity: hoveredCategory === null || hoveredCategory === c.category ? 1 : 0.4 }"
                @mouseenter="hoveredCategory = c.category"
                @mouseleave="hoveredCategory = null"
              />
            </svg>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="(c, i) in CATEGORY_RATIOS"
              :key="i"
              class="flex items-center justify-between text-xs p-1 rounded-sm"
              :class="hoveredCategory === c.category ? 'bg-slate-50 font-semibold' : ''"
              @mouseenter="hoveredCategory = c.category"
              @mouseleave="hoveredCategory = null"
            >
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: c.color }" />
                <span>{{ c.category }}</span>
              </div>
              <span class="font-mono font-semibold">{{ ((c.sales / totalCategorySales) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
        <div v-else class="space-y-3.5 pt-2">
          <div v-for="(pm, idx) in paymentMethods" :key="idx" class="space-y-1">
            <div class="flex justify-between text-xs">
              <span>{{ pm.name }}</span>
              <span class="font-mono font-semibold">{{ pm.percentage }}% ({{ pm.count }}笔)</span>
            </div>
            <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: `${pm.percentage}%`, backgroundColor: pm.color }" />
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-1.5 mb-4">
          <Percent class="w-4 h-4" /> 运营分析及建议诊断表
        </h3>
        <div class="space-y-3.5 text-xs">
          <div class="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100/50">
            <span class="font-bold text-emerald-800 block">⚡️ 经营健康度分析: 极其优秀</span>
            <p class="text-[11px] text-emerald-700 mt-1">当前周期销售 <b>¥{{ totalSales.toLocaleString() }}</b>，数码电子占比约 {{ ((CATEGORY_RATIOS[0].sales / totalCategorySales) * 100).toFixed(0) }}%。</p>
          </div>
          <div class="p-3 bg-amber-50/60 rounded-xl border border-amber-100/50">
            <span class="font-bold text-amber-800 block">💡 通道选择优化</span>
            <p class="text-[11px] text-amber-700 mt-1">支付宝与微信合计占比 75%，支付链路顺畅。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
