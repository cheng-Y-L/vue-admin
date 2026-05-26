<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Terminal, Search, Trash2, Download, AlertOctagon, CheckCircle, User } from '@lucide/vue'
import { db } from '../services/data'
import { formatLocalDateTime } from '@/utils/datetime'
import type { SystemLog, User as SystemUser } from '../types'

const props = defineProps<{ currentUser: SystemUser }>()

const logs = ref<SystemLog[]>([])
const searchQuery = ref('')
const moduleFilter = ref<'all' | SystemLog['module']>('all')
const statusFilter = ref<'all' | SystemLog['status']>('all')
const intrusionAlert = ref(false)

onMounted(() => {
  logs.value = db.getLogs()
})

const filteredLogs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return logs.value.filter((l) => {
    const matchesSearch =
      l.operator.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.ip.includes(q)
    const matchesModule = moduleFilter.value === 'all' || l.module === moduleFilter.value
    const matchesStatus = statusFilter.value === 'all' || l.status === statusFilter.value
    return matchesSearch && matchesModule && matchesStatus
  })
})

const logStats = computed(() => ({
  total: logs.value.length,
  success: logs.value.filter((l) => l.status === 'success').length,
  failed: logs.value.filter((l) => l.status === 'failed').length,
  filtered: filteredLogs.value.length,
}))

function moduleBadgeClass(module: SystemLog['module']) {
  if (module === 'Auth') return 'bg-slate-900 text-white'
  if (module === 'UserManage') return 'bg-indigo-50 text-indigo-700 border border-indigo-100'
  if (module === 'OrderManage') return 'bg-orange-50 text-orange-700 border border-orange-100'
  return 'bg-slate-50 text-slate-600 border border-slate-100'
}

function operatorIconClass(status: SystemLog['status']) {
  return status === 'success' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'
}

function handleClearLogs() {
  if (props.currentUser.role !== 'admin') {
    alert('🔒 权限控制：只有系统超级管理员拥有系统审计日志 [Delete] 抹除权限！')
    return
  }
  if (!confirm('⚠️ 极其重要警告：清除操作日志是重大审计合规风险，确定要完全清空当前的审计历史轨迹吗？')) {
    return
  }

  const systemClearedLog: SystemLog = {
    id: `LOG_${Math.random().toString(36).substring(2, 9)}`,
    operator: props.currentUser.username,
    role: '管理员',
    action: '【审计警报】超级管理员强制清空了所有历史操作日志审计流水',
    ip: '127.0.0.1',
    module: 'SystemSettings',
    status: 'success',
    timestamp: formatLocalDateTime(),
  }

  db.saveLogs([systemClearedLog])
  logs.value = [systemClearedLog]
}

function handleTriggerMockIntrusion() {
  const intruderIPs = ['103.88.23.90', '198.45.101.44', '45.122.90.15']
  const randomIP = intruderIPs[Math.floor(Math.random() * intruderIPs.length)]

  db.addLog(
    'intruder_bot',
    '游客',
    '警告：检测到该 IP 正在对系统登录接口(API/v1/auth/login)执行敏感词暴拉扫描或 SQL 注入攻击',
    'Auth',
    'failed',
    randomIP,
  )

  logs.value = db.getLogs()
  intrusionAlert.value = true
  setTimeout(() => (intrusionAlert.value = false), 4000)
}

function handleDownloadLogs() {
  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs.value, null, 2))
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute('href', dataStr)
  downloadAnchor.setAttribute('download', `system_audit_logs_${new Date().toISOString().slice(0, 10)}.json`)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  downloadAnchor.remove()

  db.addLog(
    props.currentUser.username,
    props.currentUser.role === 'admin' ? '管理员' : '运营编辑',
    '成功将当前的本地筛选审计日志数据打包并导出为本地 JSON 离线归档',
    'SystemSettings',
    'success',
  )
  logs.value = db.getLogs()
}
</script>

<template>
  <div class="space-y-6">
    <!-- 筛选控制栏 -->
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <Terminal class="w-5 h-5 text-slate-800 shrink-0" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">系统审计与核减溯源日志</h2>
          <p class="text-[11px] text-slate-500">
            追踪该组织机构下的所有写及安全登录链路事务。共 {{ logs.length }} 条流水
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        <div class="relative w-full sm:w-44 lg:w-56">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索操作简述/账号IP..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
          />
        </div>

        <select
          v-model="moduleFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">任意模块</option>
          <option value="Auth">🔐 身份授权 (Auth)</option>
          <option value="UserManage">👥 成员管控 (UserManage)</option>
          <option value="OrderManage">🛒 资金订单流水 (OrderManage)</option>
          <option value="Permissions">⛓️ 权限配置 (Permissions)</option>
          <option value="SystemSettings">⚙️ 系统审计 (SystemSettings)</option>
        </select>

        <select
          v-model="statusFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部执行状态</option>
          <option value="success">正常成功 (success)</option>
          <option value="failed">拦截阻断 (failed)</option>
        </select>

        <button
          class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors border border-red-100 cursor-pointer"
          title="模拟机器人网络安全威胁进行入库记录展示"
          @click="handleTriggerMockIntrusion"
        >
          模拟威胁
        </button>

        <button
          class="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer"
          title="打包下载 JSON 审计流水"
          @click="handleDownloadLogs"
        >
          <Download class="w-4 h-4" />
        </button>

        <button
          v-if="currentUser.role === 'admin'"
          class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
          title="清空并释放底层日志存储区"
          @click="handleClearLogs"
        >
          <Trash2 class="w-3.5 h-3.5" />
          清核
        </button>
      </div>
    </div>

    <!-- 审计统计 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white border border-slate-100 rounded-xl p-3 shadow-xs">
        <span class="text-[10px] text-slate-500 block">全量流水</span>
        <span class="font-space font-bold text-xl text-slate-900">{{ logStats.total }}</span>
      </div>
      <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
        <span class="text-[10px] text-emerald-600 block">审计正常</span>
        <span class="font-space font-bold text-xl text-emerald-700">{{ logStats.success }}</span>
      </div>
      <div class="bg-red-50 border border-red-100 rounded-xl p-3">
        <span class="text-[10px] text-red-600 block">已阻断</span>
        <span class="font-space font-bold text-xl text-red-700">{{ logStats.failed }}</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <span class="text-[10px] text-slate-400 block">当前筛选</span>
        <span class="font-space font-bold text-xl text-slate-100">{{ logStats.filtered }}</span>
      </div>
    </div>

    <!-- 入侵预警 -->
    <Transition name="fade">
      <div
        v-if="intrusionAlert"
        class="p-4 bg-red-600 text-white rounded-xl flex items-start gap-3 shadow-lg"
      >
        <AlertOctagon class="w-6 h-6 shrink-0 mt-0.5 animate-bounce" />
        <div>
          <h4 class="text-sm font-bold">⚠️ 实时系统入侵审计：安全预警级别 3</h4>
          <p class="text-xs text-red-100 mt-1 leading-relaxed font-sans">
            安全中心检测到恶意指纹 IP 暴拉。系统底层过滤审计程序已自动嗅探特征、在零物理延迟下执行了全面拦截阻断，并在下方成功入库了一条
            <b>[status = failed]</b> 拦截记录用于核查备案。
          </p>
        </div>
      </div>
    </Transition>

    <!-- 审计日志表格 -->
    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse min-w-3xl">
        <thead>
          <tr class="border-b border-slate-150 text-slate-400 font-medium">
            <th class="py-3 px-2 w-[18%]">核查审计流水号</th>
            <th class="py-3 px-2 w-[16%]">操作时刻 (Timestamp)</th>
            <th class="py-3 px-2 w-[14%]">操作发起人</th>
            <th class="py-3 px-2 w-[10%]">追溯模块</th>
            <th class="py-3 px-2">行为详述详情 (Action)</th>
            <th class="py-3 px-2 w-[10%] text-center">状态响应</th>
            <th class="py-3 px-2 w-[12%] text-right font-mono">发起地 IP</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50 font-medium text-slate-700">
          <tr v-if="!filteredLogs.length">
            <td colspan="7" class="py-12 text-center text-slate-400 font-sans">
              当前条件复合过筛下，未能检索到任何相关的系统痕迹日志记录。
            </td>
          </tr>
          <tr
            v-for="l in filteredLogs"
            :key="l.id"
            class="hover:bg-slate-50/50 transition-colors"
            :class="l.status !== 'success' ? 'bg-red-50/30 font-semibold' : ''"
          >
            <td class="py-3 px-2">
              <span class="font-mono text-[10px] text-slate-400 block pb-0.5 font-bold">{{ l.id }}</span>
            </td>
            <td class="py-3 px-2 text-slate-500 font-mono">{{ l.timestamp }}</td>
            <td class="py-3 px-2">
              <div class="flex items-center gap-1.5">
                <div class="p-1 rounded-sm" :class="operatorIconClass(l.status)">
                  <User class="w-3.5 h-3.5" />
                </div>
                <div class="min-w-0">
                  <span class="text-slate-900 block truncate">@{{ l.operator }}</span>
                  <span class="text-[10px] text-slate-400 block">{{ l.role }}</span>
                </div>
              </div>
            </td>
            <td class="py-3 px-2">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" :class="moduleBadgeClass(l.module)">
                {{ l.module }}
              </span>
            </td>
            <td class="py-3 px-2 text-slate-800 font-sans max-w-sm break-all font-medium select-all leading-relaxed">
              {{ l.action }}
            </td>
            <td class="py-3 px-2 text-center">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="l.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
              >
                <component :is="l.status === 'success' ? CheckCircle : AlertOctagon" class="w-3 h-3" />
                {{ l.status === 'success' ? '审计正常' : '已阻断' }}
              </span>
            </td>
            <td class="py-3 px-2 text-right text-slate-400 font-mono text-[11px]">{{ l.ip }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
