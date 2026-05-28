<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Users,
  Briefcase,
  FileText,
  DollarSign,
  Loader2,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Ban,
} from '@lucide/vue'
import { fetchAdminPlatformStats } from '@/services/admin-stats.service'
import type { AdminPlatformStats, User } from '@/types'

defineProps<{ currentUser: User }>()

const router = useRouter()
const stats = ref<AdminPlatformStats | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  stats.value = await fetchAdminPlatformStats()
  loading.value = false
}

onMounted(load)

function formatAmount(n: number) {
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toLocaleString()}`
}

const cards = [
  { key: 'users', label: '注册用户', icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-100', path: '/user-list' },
  { key: 'tasks', label: '平台任务', icon: Briefcase, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', path: '/admin/tasks' },
  { key: 'applications', label: '承接申请', icon: FileText, color: 'text-amber-600 bg-amber-50 border-amber-100', path: '/admin/applications' },
  { key: 'deals', label: '成交结算', icon: DollarSign, color: 'text-violet-600 bg-violet-50 border-violet-100', path: '/orders' },
] as const

function cardValue(key: (typeof cards)[number]['key'], s: AdminPlatformStats): string {
  switch (key) {
    case 'users':
      return `${s.userCount} 人`
    case 'tasks':
      return `${s.taskCount} 个`
    case 'applications':
      return `${s.applicationCount} 条`
    case 'deals':
      return `${s.settledCount} 笔`
    default:
      return '—'
  }
}

function cardSub(key: (typeof cards)[number]['key'], s: AdminPlatformStats): string {
  switch (key) {
    case 'users':
      return `活跃 ${s.activeUserCount} · 律师 ${s.lawyerCount} · 发布方 ${s.publisherCount}`
    case 'tasks':
      return `待承接 ${s.pendingTaskCount} · 进行中 ${s.inProgressTaskCount} · 已完成 ${s.completedTaskCount}`
    case 'applications':
      return `待审核 ${s.pendingApplicationCount} 条`
    case 'deals':
      return `结算总额 ${formatAmount(s.settledAmount)}`
    default:
      return ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h2 class="font-space font-bold text-sm text-slate-900">平台数据看板</h2>
        <p class="text-[11px] text-slate-500 mt-0.5">用户数、任务数、申请数与成交结算概览</p>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
        :disabled="loading"
        @click="load"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="loading ? 'animate-spin' : ''" /> 刷新
      </button>
    </div>

    <div v-if="loading" class="py-16 flex justify-center text-slate-400">
      <Loader2 class="w-6 h-6 animate-spin" />
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          v-for="c in cards"
          :key="c.key"
          type="button"
          class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs text-left hover:border-slate-200 transition group"
          @click="router.push(c.path)"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="p-2 rounded-xl border" :class="c.color">
              <component :is="c.icon" class="w-5 h-5" />
            </div>
            <ArrowRight class="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
          </div>
          <div class="text-[11px] text-slate-400 font-semibold">{{ c.label }}</div>
          <div class="text-2xl font-bold text-slate-900 mt-1 font-space">{{ cardValue(c.key, stats) }}</div>
          <div class="text-[10px] text-slate-500 mt-2">{{ cardSub(c.key, stats) }}</div>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <h3 class="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Briefcase class="w-4 h-4" /> 任务状态分布
          </h3>
          <dl class="grid grid-cols-2 gap-3 text-xs">
            <div class="bg-slate-50 rounded-xl p-3">
              <dt class="text-slate-400">待承接</dt>
              <dd class="font-bold text-lg text-amber-600">{{ stats.pendingTaskCount }}</dd>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
              <dt class="text-slate-400">履约中</dt>
              <dd class="font-bold text-lg text-blue-600">{{ stats.inProgressTaskCount }}</dd>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
              <dt class="text-slate-400">已完成</dt>
              <dd class="font-bold text-lg text-emerald-600">{{ stats.completedTaskCount }}</dd>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
              <dt class="text-slate-400 flex items-center gap-1"><Ban class="w-3 h-3" /> 已下架</dt>
              <dd class="font-bold text-lg text-red-600">{{ stats.closedTaskCount }}</dd>
            </div>
          </dl>
        </div>

        <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <h3 class="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2">
            <UserCheck class="w-4 h-4" /> 用户与申请
          </h3>
          <dl class="space-y-3 text-xs">
            <div class="flex justify-between items-center py-2 border-b border-slate-50">
              <dt class="text-slate-500">注册用户总数</dt>
              <dd class="font-bold">{{ stats.userCount }}</dd>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-50">
              <dt class="text-slate-500">正常账号</dt>
              <dd class="font-bold text-emerald-600">{{ stats.activeUserCount }}</dd>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-50">
              <dt class="text-slate-500">承接申请总数</dt>
              <dd class="font-bold">{{ stats.applicationCount }}</dd>
            </div>
            <div class="flex justify-between items-center py-2">
              <dt class="text-slate-500">待审核申请</dt>
              <dd class="font-bold text-amber-600">{{ stats.pendingApplicationCount }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </template>
  </div>
</template>
