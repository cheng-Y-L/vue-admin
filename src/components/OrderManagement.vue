<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ShoppingBag,
  Search,
  Truck,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Plus,
  Lock,
  Copy,
  Check,
} from '@lucide/vue'
import { db } from '../services/data'
import type { Order, User } from '../types'

const props = defineProps<{ currentUser: User }>()

type StatusFilter = 'all' | Order['status']
type CategoryFilter = 'all' | '数码电子' | '办公家具' | '数码配件' | '影音娱乐' | '家用电器'

const orders = ref<Order[]>([])
const searchQuery = ref('')
const statusFilter = ref<StatusFilter>('all')
const categoryFilter = ref<CategoryFilter>('all')
const showAddForm = ref(false)
const customer = ref('')
const email = ref('')
const productName = ref('')
const category = ref('数码电子')
const amount = ref('')
const paymentMethod = ref<Order['paymentMethod']>('Alipay')
const exportedData = ref<string | null>(null)
const copied = ref(false)

const canManage = computed(() => props.currentUser.permissions.includes('order_manage'))

const roleLabel = computed(() =>
  props.currentUser.role === 'admin' ? '管理员' : '运营编辑',
)

onMounted(() => {
  orders.value = db.getOrders()
})

const filteredOrders = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return orders.value.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      o.productName.toLowerCase().includes(query)
    const matchesStatus = statusFilter.value === 'all' || o.status === statusFilter.value
    const matchesCategory = categoryFilter.value === 'all' || o.category === categoryFilter.value
    return matchesSearch && matchesStatus && matchesCategory
  })
})

const orderStats = computed(() => ({
  pending: orders.value.filter((o) => o.status === 'pending').length,
  shipping: orders.value.filter((o) => o.status === 'shipping').length,
  completed: orders.value.filter((o) => o.status === 'completed').length,
  canceled: orders.value.filter((o) => o.status === 'canceled').length,
  filteredAmount: filteredOrders.value.reduce((sum, o) => sum + o.amount, 0),
}))

function paymentLabel(method: Order['paymentMethod']) {
  const map: Record<Order['paymentMethod'], string> = {
    Alipay: '支付宝',
    WeChatPay: '微信支付',
    CreditCard: '信用卡',
    PayPal: 'PayPal',
  }
  return map[method]
}

function paymentClass(method: Order['paymentMethod']) {
  const map: Record<Order['paymentMethod'], string> = {
    Alipay: 'bg-blue-50 text-blue-700',
    WeChatPay: 'bg-emerald-50 text-emerald-700',
    CreditCard: 'bg-amber-50 text-amber-700',
    PayPal: 'bg-indigo-50 text-indigo-700',
  }
  return map[method]
}

function statusClass(status: Order['status']) {
  const map: Record<Order['status'], string> = {
    completed: 'bg-emerald-50 text-emerald-700',
    shipping: 'bg-blue-50 text-blue-600',
    pending: 'bg-amber-50 text-amber-700',
    canceled: 'bg-red-50 text-red-600',
  }
  return map[status]
}

function statusDotClass(status: Order['status']) {
  const map: Record<Order['status'], string> = {
    completed: 'bg-emerald-600',
    shipping: 'bg-blue-500 animate-pulse',
    pending: 'bg-amber-500',
    canceled: 'bg-red-500',
  }
  return map[status]
}

function statusText(status: Order['status']) {
  const map: Record<Order['status'], string> = {
    completed: '已成交',
    shipping: '配运中',
    pending: '待付款',
    canceled: '已取消',
  }
  return map[status]
}

function handleUpdateStatus(orderId: string, nextStatus: Order['status']) {
  if (!canManage.value) {
    alert('🔒 权限受限：您没有 [order_manage] 订单更新权限，无法操作。')
    return
  }
  const updated = orders.value.map((o) => {
    if (o.id === orderId) {
      db.addLog(
        props.currentUser.username,
        roleLabel.value,
        `更改订单状态: ${orderId} (${o.status} => ${nextStatus})`,
        'OrderManage',
        'success',
      )
      return { ...o, status: nextStatus }
    }
    return o
  })
  db.saveOrders(updated)
  orders.value = updated
}

function handleCancelOrder(orderId: string) {
  if (!canManage.value) {
    alert('🔒 权限受限：仅支持运营配属人员操作。')
    return
  }
  handleUpdateStatus(orderId, 'canceled')
}

function openAddForm() {
  if (!canManage.value) {
    alert('🔒 权限控制：仅支持 admin 或 editor 下设账户自主新增商品订单。')
    return
  }
  showAddForm.value = true
}

function resetForm() {
  customer.value = ''
  email.value = ''
  productName.value = ''
  category.value = '数码电子'
  amount.value = ''
  paymentMethod.value = 'Alipay'
}

function handleCreateOrder(e: Event) {
  e.preventDefault()
  if (!canManage.value) {
    alert('🔒 权限受限：不合规编辑角色，无法通过当前表单提交订单。')
    return
  }
  if (!customer.value.trim() || !productName.value.trim() || !amount.value.trim()) {
    alert('⚠️ 请完整填写所有必填项目')
    return
  }
  const price = parseFloat(amount.value)
  if (isNaN(price) || price <= 0) {
    alert('⚠️ 请输入合法的销售额数额')
    return
  }

  const newOrder: Order = {
    id: `ORD-${new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, '')}${Math.floor(Math.random() * 90 + 10)}`,
    customerName: customer.value.trim(),
    email: email.value.trim() || `${customer.value.trim()}@example.com`,
    productName: productName.value.trim(),
    category: category.value,
    amount: price,
    status: 'pending',
    date: new Date().toISOString().replace('T', ' ').substring(0, 19),
    paymentMethod: paymentMethod.value,
  }

  const updated = [newOrder, ...orders.value]
  db.saveOrders(updated)
  orders.value = updated

  db.addLog(
    props.currentUser.username,
    roleLabel.value,
    `自主发起新订单申报: ${newOrder.id} - ¥${price.toLocaleString()}`,
    'OrderManage',
    'success',
  )

  const summary = db.getSummary()
  localStorage.setItem(
    'admin_summary',
    JSON.stringify({
      ...summary,
      todaySales: summary.todaySales + price,
      todayOrders: summary.todayOrders + 1,
    }),
  )

  resetForm()
  showAddForm.value = false
}

function handleExportData() {
  const subset = filteredOrders.value.map((o) => ({
    订单号: o.id,
    姓名: o.customerName,
    产品名称: o.productName,
    品类: o.category,
    成交金额: o.amount,
    支付方式: o.paymentMethod,
    履约状态: o.status,
    时间: o.date,
  }))
  exportedData.value = JSON.stringify(subset, null, 2)
  db.addLog(
    props.currentUser.username,
    roleLabel.value,
    `导出筛选下的订单归类数据 (${subset.length} 条数据条目)`,
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
        <ShoppingBag class="w-5 h-5 text-slate-800 shrink-0" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">业务资金妥投与订单控制中心</h2>
          <p class="text-[11px] text-slate-500">
            搜索、分流、核减并推进交易流程。当前承载 {{ orders.length }} 条记录
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
        <div class="relative w-full sm:w-44 lg:w-56">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索订单号/顾客名/单品..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all font-medium"
          />
        </div>

        <select
          v-model="statusFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">所有履约状态</option>
          <option value="pending">⏳ 待支付付款</option>
          <option value="shipping">🚚 已配发运输中</option>
          <option value="completed">✅ 妥投交易成功</option>
          <option value="canceled">❌ 驳回订单取消</option>
        </select>

        <select
          v-model="categoryFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部分类类目</option>
          <option value="数码电子">数码电子</option>
          <option value="办公家具">办公家具</option>
          <option value="数码配件">数码配件</option>
          <option value="影音娱乐">影音娱乐</option>
        </select>

        <button
          class="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center justify-center cursor-pointer"
          title="生成本次筛选结算文本"
          @click="handleExportData"
        >
          <FileSpreadsheet class="w-4 h-4" />
        </button>

        <button
          class="px-3.5 py-1.5 bg-[#fa8231] hover:bg-[#fa8231]/95 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1 hover:shadow-xs active:scale-95 cursor-pointer"
          @click="openAddForm"
        >
          <Plus class="w-3.5 h-3.5" />
          新增申单
        </button>
      </div>
    </div>

    <!-- 履约状态概览 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="item in [
          { label: '待支付', value: orderStats.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
          { label: '配运中', value: orderStats.shipping, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
          { label: '已成交', value: orderStats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
          { label: '已取消', value: orderStats.canceled, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
        ]"
        :key="item.label"
        class="rounded-xl border p-3"
        :class="item.bg"
      >
        <span class="text-[10px] font-medium text-slate-500 block">{{ item.label }}</span>
        <span class="font-space font-bold text-xl mt-0.5" :class="item.color">{{ item.value }}</span>
      </div>
    </div>

    <!-- 筛选结果摘要 -->
    <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      <span class="bg-slate-100 px-2.5 py-1 rounded-full font-medium">
        当前筛选 {{ filteredOrders.length }} 笔
      </span>
      <span class="bg-orange-50 text-[#fa8231] px-2.5 py-1 rounded-full font-mono font-semibold border border-orange-100">
        合计 ¥{{ orderStats.filteredAmount.toLocaleString() }}
      </span>
    </div>

    <!-- 只读提示 -->
    <div v-if="!canManage" class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
      <Lock class="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
      <div>
        <h4 class="text-xs font-semibold text-slate-700">只读控制模式激活中</h4>
        <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          您拥有的数据分析员或游客角色缺乏 <b>order_manage</b> 编辑许可。您可以随时使用上行搜索或表单导出大盘信息，但下方状态更改（发货、完成、一键撤销、新增）等控制节点将置为不可点击。
        </p>
      </div>
    </div>

    <!-- 订单表格 -->
    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse min-w-3xl">
        <thead>
          <tr class="border-b border-slate-150 text-slate-400 font-medium font-sans">
            <th class="py-3 px-2 w-[18%]">结算单号</th>
            <th class="py-3 px-2 w-[15%]">买主基本信息</th>
            <th class="py-3 px-2">交易单件物件</th>
            <th class="py-3 px-2 w-[12%]">类别</th>
            <th class="py-3 px-2 w-[12%] text-right font-semibold">营业折合</th>
            <th class="py-3 px-2 w-[10%] text-center">支付结算方式</th>
            <th class="py-3 px-2 w-[10%] text-center">当前进度</th>
            <th class="py-3 px-2 text-right w-[15%]">操作履约核心</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50 text-slate-700 font-medium">
          <tr v-if="!filteredOrders.length">
            <td colspan="8" class="py-12 text-center text-slate-400 font-medium">
              根据设定的复合过滤，未能提取到符合规要求的订单。
            </td>
          </tr>
          <tr
            v-for="o in filteredOrders"
            :key="o.id"
            class="hover:bg-slate-50/40 transition-colors"
            :class="o.status === 'canceled' ? 'bg-red-50/10' : ''"
          >
            <td class="py-3.5 px-2">
              <span class="font-mono font-bold text-slate-900 block">{{ o.id }}</span>
              <span class="font-mono text-[10px] text-slate-400 block mt-0.5">{{ o.date }}</span>
            </td>
            <td class="py-3.5 px-2">
              <span class="font-bold text-slate-800 block">{{ o.customerName }}</span>
              <span class="text-[10px] text-slate-400 block break-all font-mono">{{ o.email }}</span>
            </td>
            <td class="py-3.5 px-2">
              <span class="truncate block font-medium max-w-xs" :title="o.productName">{{ o.productName }}</span>
            </td>
            <td class="py-3.5 px-2">
              <span class="text-[11px] bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-sm">
                {{ o.category }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-right">
              <span class="font-mono text-xs font-bold text-slate-900">¥{{ o.amount.toLocaleString() }}</span>
            </td>
            <td class="py-3.5 px-2 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="paymentClass(o.paymentMethod)">
                {{ paymentLabel(o.paymentMethod) }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-center">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="statusClass(o.status)"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="statusDotClass(o.status)" />
                {{ statusText(o.status) }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-right">
              <div class="flex gap-1.5 justify-end">
                <button
                  v-if="o.status === 'pending'"
                  :disabled="!canManage"
                  class="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                  title="配置揽收并发货"
                  @click="handleUpdateStatus(o.id, 'shipping')"
                >
                  <Truck class="w-3 h-3" />
                  发货
                </button>
                <button
                  v-if="o.status === 'shipping'"
                  :disabled="!canManage"
                  class="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                  title="确认客户安全妥投"
                  @click="handleUpdateStatus(o.id, 'completed')"
                >
                  <CheckCircle2 class="w-3 h-3" />
                  妥投
                </button>
                <button
                  v-if="o.status !== 'canceled' && o.status !== 'completed'"
                  :disabled="!canManage"
                  class="p-1 hover:bg-red-50 text-red-600 rounded disabled:opacity-50 cursor-pointer"
                  title="撤销废弃此交易"
                  @click="handleCancelOrder(o.id)"
                >
                  <XCircle class="w-4.5 h-4.5" />
                </button>
                <span
                  v-if="o.status === 'completed' || o.status === 'canceled'"
                  class="text-[10px] text-slate-400 font-sans italic"
                >
                  结单入库
                </span>
              </div>
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
            数据流出预览盘 (JSON Segment)
          </span>
          <div class="flex items-center gap-2">
            <button
              class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md transition flex items-center gap-1 cursor-pointer"
              @click="handleCopyToClipboard"
            >
              <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" :class="copied ? 'text-emerald-400' : ''" />
              {{ copied ? '已复制' : '复制数据' }}
            </button>
            <button class="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded" @click="exportedData = null">
              <XCircle class="w-4 h-4" />
            </button>
          </div>
        </div>
        <pre class="text-[10px] overflow-auto max-h-48 leading-relaxed max-w-full">{{ exportedData }}</pre>
      </div>
    </Transition>

    <!-- 新增订单弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showAddForm"
          class="fixed inset-0 bg-slate-950/30 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-100">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Plus class="w-5 h-5 text-slate-800" />
                新增销售业绩申报单
              </h3>
              <button class="p-1 hover:bg-slate-100 rounded text-slate-400" @click="showAddForm = false">
                <XCircle class="w-4.5 h-4.5" />
              </button>
            </div>

            <form class="space-y-4 text-left" @submit="handleCreateOrder">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">买方客户姓名 *</label>
                <input
                  v-model="customer"
                  type="text"
                  placeholder="请输入姓名，如 陈明"
                  required
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">电子邮箱 (选填)</label>
                <input
                  v-model="email"
                  type="email"
                  placeholder="your@customer.com"
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">成交单品名称 *</label>
                <input
                  v-model="productName"
                  type="text"
                  placeholder="请输入购买商品全名，如 Cherry 轴定制版键盘"
                  required
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">品类分配</label>
                  <select
                    v-model="category"
                    class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                  >
                    <option value="数码电子">数码电子</option>
                    <option value="办公家具">办公家具</option>
                    <option value="数码配件">数码配件</option>
                    <option value="影音娱乐">影音娱乐</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">实付金额 (元) *</label>
                  <input
                    v-model="amount"
                    type="number"
                    step="0.01"
                    placeholder="199.00"
                    required
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
                  />
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">预定支付方式</label>
                <select
                  v-model="paymentMethod"
                  class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                >
                  <option value="Alipay">支付宝 (Alipay)</option>
                  <option value="WeChatPay">微信支付 (WeChatPay)</option>
                  <option value="CreditCard">信用卡双币结算 (CreditCard)</option>
                  <option value="PayPal">贝宝跨境结汇 (PayPal)</option>
                </select>
              </div>
              <div class="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
                  @click="showAddForm = false"
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="px-3.5 py-1.5 bg-[#fa8231] hover:bg-[#fa8231]/95 text-white text-xs font-semibold rounded-lg transition shadow-md active:scale-95 cursor-pointer"
                >
                  确认申报入库
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
