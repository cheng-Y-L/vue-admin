<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingBag,
  Percent,
  ArrowRight,
  Activity,
  PlusCircle,
  Clock,
  PieChart,
  BarChart3,
  Filter,
  Eye,
  Calendar,
} from '@lucide/vue'
import type { LucideIcon } from '@lucide/vue'
import { db, METRIC_HISTORY, CATEGORY_RATIOS } from '@/services/data'
import { LEGACY_TAB_TO_PATH } from '@/router/nav'
import type { User, Order, SystemLog, StatSummary } from '@/types'

const props = defineProps<{
  user: User
}>()

const router = useRouter()

function navigateTo(tabId: string) {
  const path = LEGACY_TAB_TO_PATH[tabId]
  if (path) router.push(path)
}

const summary = ref<StatSummary>(db.getSummary())
const orders = ref<Order[]>([])
const recentLogs = ref<SystemLog[]>([])

const activeChartPoint = ref<number | null>(null)
const hoveredCategory = ref<string | null>(null)
const activeBarIndex = ref<number | null>(null)
const activeFunnelIndex = ref<number | null>(null)

onMounted(() => {
  orders.value = db.getOrders().slice(0, 5)
  recentLogs.value = db.getLogs().slice(0, 4)
})

function handleQuickOrder() {
  const freshOrders = db.getOrders()
  const names = ['张晓华', '徐杰', '郭明', '李丽莎', '马俊', '唐薇']
  const emails = [
    'xiaohua@example.com',
    'xujie@example.com',
    'guoming@example.com',
    'lisa@example.com',
    'majun@example.com',
    'tangwei@example.com',
  ]
  const products = [
    { name: '4K超清 无边框曲面电竞显示器', price: 4299, cat: '数码电子' },
    { name: '人体工学支撑升降电脑椅 Executive-X', price: 6800, cat: '办公家具' },
    { name: '无线高敏低阻电竞滑鼠 v2', price: 499, cat: '数码配件' },
    { name: '多声道杜比家庭影院条形音箱', price: 3499, cat: '影音娱乐' },
  ]

  const randomNameIndex = Math.floor(Math.random() * names.length)
  const randomProduct = products[Math.floor(Math.random() * products.length)]
  const randomPayment = ['Alipay', 'WeChatPay', 'CreditCard', 'PayPal'][
    Math.floor(Math.random() * 4)
  ] as Order['paymentMethod']

  const newOrder: Order = {
    id: `ORD-${new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '')}${Math.floor(Math.random() * 90 + 10)}`,
    customerName: names[randomNameIndex],
    email: emails[randomNameIndex],
    productName: randomProduct.name,
    category: randomProduct.cat,
    amount: randomProduct.price,
    status: 'pending',
    date: new Date().toISOString().replace('T', ' ').substring(0, 19),
    paymentMethod: randomPayment,
  }

  const updated = [newOrder, ...freshOrders]
  db.saveOrders(updated)
  orders.value = updated.slice(0, 5)

  db.addLog(
    props.user.username,
    props.user.role === 'admin' ? '管理员' : '运营编辑',
    `快捷面板成功模拟并促成新交易订单：${newOrder.id}`,
    'OrderManage',
    'success',
  )

  const updatedSummary = {
    ...summary.value,
    todaySales: summary.value.todaySales + randomProduct.price,
    todayOrders: summary.value.todayOrders + 1,
  }
  db.saveUsers(db.getUsers())
  localStorage.setItem('admin_summary', JSON.stringify(updatedSummary))
  summary.value = updatedSummary

  recentLogs.value = db.getLogs().slice(0, 4)
}

const metricCards: {
  title: string
  value: () => string
  change: () => number
  icon: LucideIcon
  color: string
}[] = [
  {
    title: '今日销售总额',
    value: () => `¥${summary.value.todaySales.toLocaleString()}`,
    change: () => summary.value.todaySalesChange,
    icon: DollarSign,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
  {
    title: '今日累计成交',
    value: () => `${summary.value.todayOrders} 笔`,
    change: () => summary.value.todayOrdersChange,
    icon: ShoppingBag,
    color: 'text-[#fa8231] bg-orange-50 border-orange-100',
  },
  {
    title: '今日活跃UV',
    value: () => summary.value.activeUsers.toLocaleString(),
    change: () => summary.value.activeUsersChange,
    icon: Users,
    color: 'text-blue-600 bg-blue-50 border-blue-100',
  },
  {
    title: '全店综合转化率',
    value: () => `${summary.value.conversionRate}%`,
    change: () => summary.value.conversionRateChange,
    icon: Percent,
    color: 'text-violet-600 bg-violet-50 border-violet-100',
  },
]

// Line chart
const width = 600
const height = 180

const selectedHistory = computed(() =>
  activeChartPoint.value !== null
    ? METRIC_HISTORY[activeChartPoint.value]
    : METRIC_HISTORY[METRIC_HISTORY.length - 1],
)

const lineChartGeometry = computed(() => {
  const maxSales = Math.max(...METRIC_HISTORY.map((m) => m.sales))
  const minSales = Math.min(...METRIC_HISTORY.map((m) => m.sales))
  const maxDiff = maxSales - minSales || 1

  const points = METRIC_HISTORY.map((m, i) => {
    const x = (i / (METRIC_HISTORY.length - 1)) * (width - 40) + 20
    const y = height - ((m.sales - minSales) / maxDiff) * (height - 45) - 15
    return { x, y, ...m }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return { points, linePath, areaPath }
})

const points = computed(() => lineChartGeometry.value.points)
const linePath = computed(() => lineChartGeometry.value.linePath)
const areaPath = computed(() => lineChartGeometry.value.areaPath)

// Donut chart
const totalSales = computed(() => CATEGORY_RATIOS.reduce((acc, curr) => acc + curr.sales, 0))
const radius = 60
const circumference = 2 * Math.PI * radius

const donutSlices = computed(() => {
  let currentAccumulatedPercentage = 0
  return CATEGORY_RATIOS.map((cat) => {
    const percentage = cat.sales / totalSales.value
    const strokeDash = `${percentage * circumference} ${circumference}`
    const strokeOffset = circumference - currentAccumulatedPercentage * circumference
    const startAngle = currentAccumulatedPercentage * 360
    currentAccumulatedPercentage += percentage
    return {
      ...cat,
      percentage,
      strokeDash,
      strokeOffset,
      startAngle,
    }
  })
})

const activeCategoryData = computed(() =>
  hoveredCategory.value
    ? donutSlices.value.find((s) => s.category === hoveredCategory.value) ?? null
    : null,
)

// Dual bar chart
const barData = computed(() => METRIC_HISTORY.slice(-8))
const barSvgWidth = 540
const barSvgHeight = 180

const barChartScale = computed(() => ({
  maxVisitors: Math.max(...barData.value.map((d) => d.visitors)),
  maxOrdersValue: Math.max(...barData.value.map((d) => d.orders)),
  barSpacing: (barSvgWidth - 60) / barData.value.length,
}))

// Funnel
const funnelSteps = computed(() => [
  {
    name: '多维渠道曝光 (PageViews)',
    value: '12,500 PV',
    percent: '100%',
    rate: 100,
    color: '#3b82f6',
    desc: '站内外媒体联通分发',
  },
  {
    name: '站点访客激活 (UV)',
    value: `${summary.value.activeUsers.toLocaleString()} UV`,
    percent: '68.4%',
    rate: 68.4,
    color: '#10b981',
    desc: '进入站内的高价值活跃买家',
  },
  {
    name: '深度商品浏览 (Views)',
    value: '458 单日',
    percent: '46.8%',
    rate: 46.8,
    color: '#8b5cf6',
    desc: '查看配置参数与详情主图',
  },
  {
    name: '意向下单流转 (Submit)',
    value: '112 单',
    percent: '11.4%',
    rate: 11.4,
    color: '#f59e0b',
    desc: '确认订单并进入待付结算',
  },
  {
    name: '今日付款成功 (Paid)',
    value: `${summary.value.todayOrders} 笔`,
    percent: `${summary.value.conversionRate}%`,
    rate: summary.value.conversionRate,
    color: '#fa8231',
    desc: '全店综合转化并成功到账',
  },
])

function orderStatusLabel(status: Order['status']) {
  if (status === 'completed') return '交易成功'
  if (status === 'shipping') return '已发货'
  if (status === 'pending') return '待付款'
  return '已取消'
}

function orderStatusClass(status: Order['status']) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'shipping') return 'bg-blue-50 text-blue-700'
  if (status === 'pending') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}
</script>

<template>
  <div class="space-y-6">
    <!-- 1. Welcoming Hero Banner -->
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
                  : user.role === 'editor'
                    ? '✍️ 智能运营编辑'
                    : '👁️ 特约数据分析员'
              }}
            </span>
            <span class="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock class="w-3.5 h-3.5 text-slate-400" />
              数据最近更新: 刚刚
            </span>
          </div>
          <h1 class="font-space font-bold text-2xl mt-2">欢迎回来，{{ user.nickname }}!</h1>
          <p class="text-slate-400 text-xs mt-1">
            智慧大屏控制台集成【折线、环圈占比、成交对比、多维漏斗】全要素业务监控组件。
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 bg-slate-850 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors flex items-center gap-1 cursor-pointer"
            @click="navigateTo('data_stats_view')"
          >
            <Eye class="w-3.5 h-3.5 text-[#fa8231]" />
            数据大盘
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-[#fa8231] hover:bg-[#fa8231]/95 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            @click="handleQuickOrder"
          >
            <PlusCircle class="w-4 h-4" />
            虚拟下单测试
          </button>
        </div>
      </div>
    </div>

    <!-- 2. Key Metrics Grid Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="(item, index) in metricCards"
        :key="index"
        class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-500">{{ item.title }}</span>
          <div :class="['p-2 rounded-xl border shrink-0', item.color]">
            <component :is="item.icon" class="w-4 h-4" />
          </div>
        </div>

        <div class="mt-4">
          <span class="font-space font-bold text-2xl text-slate-900">{{ item.value() }}</span>
          <div class="flex items-center gap-1.5 mt-2">
            <span
              v-if="item.change() >= 0"
              class="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-0.5"
            >
              <TrendingUp class="w-3 h-3" />
              +{{ item.change() }}%
            </span>
            <span
              v-else
              class="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-0.5"
            >
              <TrendingDown class="w-3 h-3" />
              {{ item.change() }}%
            </span>
            <span class="text-[10px] text-slate-400">较昨日同期</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. UPPER ROW Charts Group -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- CHART 1: Interactive Line Chart -->
      <div
        class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-2 flex flex-col justify-between"
      >
        <div>
          <div class="flex items-center justify-between mb-2">
            <div>
              <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
                <Activity class="w-4 h-4 text-orange-500" />
                交易与流量变化趋势折线
              </h3>
              <p class="text-[11px] text-slate-500 mt-0.5">
                最近15天业绩波动指标，浮动交互可穿透查看具体节点事件
              </p>
            </div>
            <span class="text-[10px] bg-slate-900 text-slate-100 px-2 py-0.5 rounded font-mono font-bold">
              15 Days Timeline
            </span>
          </div>

          <div class="relative pt-4">
            <svg
              :viewBox="`0 0 ${width} ${height}`"
              class="w-full h-auto overflow-visible select-none"
            >
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
              <path
                :d="linePath"
                fill="none"
                stroke="#fa8231"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <g
                v-for="(p, i) in points"
                :key="i"
                class="cursor-pointer"
              >
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
                <circle
                  v-if="activeChartPoint === i"
                  :cx="p.x"
                  :cy="p.y"
                  r="6"
                  fill="#fa8231"
                />
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

        <div class="grid grid-cols-3 gap-2 mt-6 bg-slate-50 border border-slate-100 rounded-xl p-3">
          <div class="text-center">
            <span class="text-[10px] text-slate-500 block">节点日期</span>
            <span class="text-xs font-mono font-bold text-slate-900">{{ selectedHistory.date }}</span>
          </div>
          <div class="text-center border-x border-slate-200">
            <span class="text-[10px] text-slate-500 block">营业总额 (CNY)</span>
            <span class="text-xs font-mono font-bold text-[#fa8231]">
              ¥{{ selectedHistory.sales.toLocaleString() }}
            </span>
          </div>
          <div class="text-center">
            <span class="text-[10px] text-slate-500 block">成交单量 / 访客</span>
            <span class="text-xs font-mono font-bold text-slate-900">
              {{ selectedHistory.orders }} 单 / {{ selectedHistory.visitors }} 人
            </span>
          </div>
        </div>
      </div>

      <!-- CHART 2: Donut Chart -->
      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div>
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
            <PieChart class="w-4 h-4 text-indigo-500" />
            热门商品品类销售占比
          </h3>
          <p class="text-[11px] text-slate-500 mt-0.5">
            基于当前系统成单明细按一级目科占比，可滑过分段或图例聚焦
          </p>
        </div>

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
                :stroke-width="hoveredCategory === slice.category ? 16 : 10"
                :stroke-dasharray="slice.strokeDash"
                :stroke-dashoffset="slice.strokeOffset"
                class="transition-all duration-300 cursor-pointer"
                @mouseenter="hoveredCategory = slice.category"
                @mouseleave="hoveredCategory = null"
              />
            </svg>

            <div
              class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center"
            >
              <span class="text-[9px] text-slate-400 font-medium tracking-tight uppercase">
                {{ activeCategoryData ? activeCategoryData.category : '分分类销售额' }}
              </span>
              <span class="text-sm font-bold font-mono text-slate-800">
                {{
                  activeCategoryData
                    ? `¥${activeCategoryData.sales.toLocaleString()}`
                    : `¥${totalSales.toLocaleString()}`
                }}
              </span>
              <span class="text-[9px] text-emerald-600 font-mono font-semibold">
                {{
                  activeCategoryData
                    ? `${(activeCategoryData.percentage * 100).toFixed(1)}%`
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
            :class="[
              'flex items-center justify-between text-[11px] p-1.5 rounded transition-all cursor-pointer',
              hoveredCategory === item.category
                ? 'bg-slate-50 scale-[1.02] border-l-2'
                : 'hover:bg-slate-50/50',
            ]"
            :style="{
              borderLeftColor: hoveredCategory === item.category ? item.color : 'transparent',
            }"
            @mouseenter="hoveredCategory = item.category"
            @mouseleave="hoveredCategory = null"
          >
            <div class="flex items-center gap-2 truncate max-w-[65%]">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
              <span class="text-slate-700 font-medium truncate">{{ item.category }}</span>
            </div>
            <div class="font-mono text-slate-500 flex items-center gap-1 shrink-0 text-right">
              <span>¥{{ item.sales.toLocaleString() }}</span>
              <span class="text-slate-400">({{ (item.percentage * 100).toFixed(1) }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. LOWER ROW Charts Group -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- CHART 3: Dual-bar Chart -->
      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
                <BarChart3 class="w-4 h-4 text-emerald-500" />
                客流访客 / 支付单量双柱对比
              </h3>
              <p class="text-[11px] text-slate-500 mt-0.5">
                展现最近 8 日总活跃UV与订单笔数关联趋势，研判流量效能转化
              </p>
            </div>
            <div class="flex gap-2 text-[10px] font-medium shrink-0">
              <span class="flex items-center gap-1 text-slate-600">
                <span class="w-2 h-2 rounded bg-indigo-500 inline-block" />
                UV / 访客数
              </span>
              <span class="flex items-center gap-1 text-slate-600">
                <span class="w-2 h-2 rounded bg-emerald-500 inline-block" />
                成交单量
              </span>
            </div>
          </div>

          <div class="relative pt-6">
            <svg
              :viewBox="`0 0 ${barSvgWidth} ${barSvgHeight}`"
              class="w-full h-auto overflow-visible select-none"
            >
              <line
                x1="30"
                y1="20"
                :x2="barSvgWidth - 10"
                y2="20"
                stroke="#f1f5f9"
                stroke-dasharray="3 3"
              />
              <line
                x1="30"
                y1="70"
                :x2="barSvgWidth - 10"
                y2="70"
                stroke="#f1f5f9"
                stroke-dasharray="3 3"
              />
              <line
                x1="30"
                y1="120"
                :x2="barSvgWidth - 10"
                y2="120"
                stroke="#f1f5f9"
                stroke-dasharray="3 3"
              />
              <line
                x1="30"
                y1="150"
                :x2="barSvgWidth - 10"
                y2="150"
                stroke="#f1f5f9"
                stroke-dasharray="1 0"
              />

              <g
                v-for="(d, index) in barData"
                :key="`bar-${index}`"
                class="transition-all duration-200"
              >
                <rect
                  :x="40 + index * barChartScale.barSpacing - 15"
                  y="10"
                  :width="barChartScale.barSpacing - 6"
                  height="145"
                  :fill="
                    activeBarIndex === index ? 'rgba(79, 70, 229, 0.03)' : 'transparent'
                  "
                  rx="8"
                  class="cursor-pointer"
                  @mouseenter="activeBarIndex = index"
                  @mouseleave="activeBarIndex = null"
                />
                <rect
                  :x="40 + index * barChartScale.barSpacing - 10"
                  :y="150 - (d.visitors / barChartScale.maxVisitors) * 115"
                  width="8"
                  :height="
                    (d.visitors / barChartScale.maxVisitors) * 115 > 0
                      ? (d.visitors / barChartScale.maxVisitors) * 115
                      : 2
                  "
                  :fill="activeBarIndex === index ? '#6366f1' : '#818cf8'"
                  rx="2"
                  class="transition-all"
                />
                <rect
                  :x="40 + index * barChartScale.barSpacing + 1"
                  :y="150 - (d.orders / barChartScale.maxOrdersValue) * 105"
                  width="8"
                  :height="
                    (d.orders / barChartScale.maxOrdersValue) * 105 > 0
                      ? (d.orders / barChartScale.maxOrdersValue) * 105
                      : 2
                  "
                  :fill="activeBarIndex === index ? '#059669' : '#34d399'"
                  rx="2"
                  class="transition-all"
                />
                <text
                  :x="40 + index * barChartScale.barSpacing - 1"
                  y="167"
                  text-anchor="middle"
                  :fill="activeBarIndex === index ? '#000000' : '#475569'"
                  font-size="9"
                  :font-weight="activeBarIndex === index ? 'bold' : 'normal'"
                  class="font-mono"
                >
                  {{ d.date }}
                </text>
              </g>
            </svg>
          </div>
        </div>

        <div
          class="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-2 px-3 flex justify-between items-center h-11 text-xs"
        >
          <template v-if="activeBarIndex !== null">
            <span class="font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar class="w-3.5 h-3.5 text-slate-400" />
              分析日期: {{ barData[activeBarIndex].date }}
            </span>
            <span class="text-indigo-600 font-mono font-medium">
              访客UV:
              <b class="font-bold">{{ barData[activeBarIndex].visitors }} 人</b>
            </span>
            <span class="text-emerald-700 font-mono font-medium">
              成交订单:
              <b class="font-bold">{{ barData[activeBarIndex].orders }} 笔</b>
            </span>
            <span class="text-slate-500 font-mono">
              单均客成比:
              <b>
                {{
                  (
                    (barData[activeBarIndex].orders / barData[activeBarIndex].visitors) *
                    100
                  ).toFixed(1)
                }}%
              </b>
            </span>
          </template>
          <span
            v-else
            class="text-slate-400 mx-auto text-[11px] flex items-center gap-1"
          >
            💡 划过上方柱状图块可穿透提取当日的“流量/单量转化效率”
          </span>
        </div>
      </div>

      <!-- CHART 4: Conversion Funnel -->
      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div>
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
            <Filter class="w-4 h-4 text-orange-500" />
            店铺全链路转化核心漏斗
          </h3>
          <p class="text-[11px] text-slate-500 mt-0.5">
            监控从曝光引流到完成付款的闭环转化率，诊断经营损耗流失环节
          </p>
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
              class="absolute inset-y-0 left-0 bg-slate-50 border-r border-slate-100 rounded-l-xl opacity-30 transition-all pointer-events-none"
              :style="{ width: `${step.rate}%` }"
            />

            <div class="flex justify-between items-center relative z-10">
              <div class="flex items-center gap-2.5">
                <span
                  class="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center font-mono shrink-0 shadow-xs"
                  :style="{ backgroundColor: step.color }"
                >
                  {{ index + 1 }}
                </span>
                <div class="min-w-0">
                  <span class="text-xs font-semibold text-slate-800 block leading-tight">
                    {{ step.name }}
                  </span>
                  <span class="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[240px]">
                    {{ step.desc }}
                  </span>
                </div>
              </div>

              <div class="text-right shrink-0">
                <span class="text-xs font-bold font-mono text-slate-900 block">{{ step.value }}</span>
                <span class="text-[10px] text-slate-500 font-medium">
                  核心漏斗比: {{ step.percent }}
                </span>
              </div>
            </div>

            <div
              v-if="index < funnelSteps.length - 1"
              class="absolute -bottom-2 right-12 z-20 bg-slate-900 text-slate-100 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold border border-slate-800 scale-90 pointer-events-none"
            >
              转化率:
              {{ ((funnelSteps[index + 1].rate / step.rate) * 100).toFixed(1) }}% ↓
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. Footer Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShoppingBag class="w-4 h-4 text-[#fa8231]" />
            最新付款订单 (实时动态)
          </h3>
          <button
            type="button"
            class="text-[11px] font-semibold text-[#fa8231] hover:underline flex items-center gap-0.5 cursor-pointer"
            @click="navigateTo('order_manage')"
          >
            订单详情表
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="divide-y divide-slate-100">
          <div v-if="orders.length === 0" class="py-6 text-center text-slate-400 text-xs">
            暂无订单数据
          </div>
          <div
            v-for="(ord, idx) in orders"
            v-else
            :key="idx"
            class="py-3 flex items-center justify-between gap-2 hover:bg-slate-50/40 px-1 rounded-sm transition-colors"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-bold text-slate-900 truncate">{{ ord.id }}</span>
                <span
                  :class="[
                    'px-1.5 py-0.5 rounded-sm text-[10px] font-semibold',
                    orderStatusClass(ord.status),
                  ]"
                >
                  {{ orderStatusLabel(ord.status) }}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 truncate mt-0.5">{{ ord.productName }}</p>
            </div>
            <div class="text-right shrink-0">
              <span class="font-mono text-xs font-bold text-slate-800 block">
                ¥{{ ord.amount.toLocaleString() }}
              </span>
              <span class="text-[10px] text-slate-400 font-mono">{{ ord.date.substring(5, 16) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-2">
            <Activity class="w-4 h-4 text-slate-800" />
            审计操作日志 (核心流水)
          </h3>
          <button
            type="button"
            class="text-[11px] font-semibold text-[#fa8231] hover:underline flex items-center gap-0.5 cursor-pointer"
            @click="navigateTo('system_logs_view')"
          >
            日志核对板
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="space-y-4">
          <div v-if="recentLogs.length === 0" class="py-6 text-center text-slate-400 text-xs">
            暂无操作日志
          </div>
          <div
            v-for="(log, idx) in recentLogs"
            v-else
            :key="idx"
            class="flex gap-3 text-xs leading-relaxed"
          >
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
                <span class="font-semibold text-slate-900 font-mono">
                  @{{ log.operator }} ({{ log.role }})
                </span>
                <span class="text-[10px] font-mono text-slate-400">
                  {{ log.timestamp.substring(11, 19) }}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">{{ log.action }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
