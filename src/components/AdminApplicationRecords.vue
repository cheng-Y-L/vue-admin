<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FileText, Search, Loader2, ExternalLink } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { fetchAllApplicationRecords } from '@/services/task-application.service'
import {
  TASK_APPLICATION_STATUS_LABELS,
  TASK_APPLICATION_STATUS_CLASS,
  TASK_STATUS_LABELS,
  type TaskApplicationStatus,
} from '@/constants/tasks'
import type { ApplicationRecord, User } from '@/types'

defineProps<{ currentUser: User }>()

const router = useRouter()
const records = ref<ApplicationRecord[]>([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref<'all' | TaskApplicationStatus>('all')

onMounted(async () => {
  loading.value = true
  records.value = await fetchAllApplicationRecords()
  loading.value = false
})

const filteredRecords = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return records.value.filter((r) => {
    const matchesStatus = statusFilter.value === 'all' || r.status === statusFilter.value
    const matchesSearch =
      !q ||
      r.task?.title.toLowerCase().includes(q) ||
      r.lawyer?.nickname.toLowerCase().includes(q) ||
      r.lawyer?.username.toLowerCase().includes(q) ||
      r.publisher?.nickname.toLowerCase().includes(q) ||
      r.proposal.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })
})

function formatQuote(quote: number | null) {
  if (quote === null) return '面议'
  return `¥${quote.toLocaleString()}`
}

function goTask(taskId: string) {
  router.push(`/orders/${taskId}`)
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <FileText class="w-5 h-5 text-slate-800" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">申请记录管理</h2>
          <p class="text-[11px] text-slate-500">查看全平台律师承接申请</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <div class="relative w-full sm:w-56">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索任务/律师/发布方..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
          />
        </div>
        <select v-model="statusFilter" class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
          <option value="all">全部状态</option>
          <option v-for="(label, key) in TASK_APPLICATION_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
    </div>

    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs overflow-x-auto">
      <div v-if="loading" class="py-12 flex justify-center text-slate-400">
        <Loader2 class="w-6 h-6 animate-spin" />
      </div>
      <table v-else class="w-full text-xs text-left min-w-5xl">
        <thead>
          <tr class="border-b border-slate-100 text-slate-400">
            <th class="py-3 px-2">任务</th>
            <th class="py-3 px-2">律师</th>
            <th class="py-3 px-2">发布方</th>
            <th class="py-3 px-2">报价</th>
            <th class="py-3 px-2">方案简述</th>
            <th class="py-3 px-2 text-center">申请状态</th>
            <th class="py-3 px-2">申请时间</th>
            <th class="py-3 px-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="!filteredRecords.length">
            <td colspan="8" class="py-8 text-center text-slate-400">无匹配申请记录</td>
          </tr>
          <tr v-for="r in filteredRecords" :key="r.id" class="hover:bg-slate-50/50">
            <td class="py-3.5 px-2">
              <span class="font-semibold block max-w-[180px] truncate">{{ r.task?.title ?? '—' }}</span>
              <span v-if="r.task" class="text-[10px] text-slate-400">{{ TASK_STATUS_LABELS[r.task.status] }}</span>
            </td>
            <td class="py-3.5 px-2">
              <span class="font-semibold">{{ r.lawyer?.nickname ?? '—' }}</span>
              <span class="text-[10px] text-slate-400 block font-mono">@{{ r.lawyer?.username }}</span>
            </td>
            <td class="py-3.5 px-2 text-[11px]">{{ r.publisher?.nickname ?? '—' }}</td>
            <td class="py-3.5 px-2 font-mono font-bold">{{ formatQuote(r.quote) }}</td>
            <td class="py-3.5 px-2 max-w-[200px]">
              <p class="line-clamp-2 text-[11px] text-slate-600">{{ r.proposal }}</p>
            </td>
            <td class="py-3.5 px-2 text-center">
              <span
                class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="TASK_APPLICATION_STATUS_CLASS[r.status]"
              >
                {{ TASK_APPLICATION_STATUS_LABELS[r.status] }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-[10px] text-slate-500 font-mono whitespace-nowrap">
              {{ r.createdAt.replace('T', ' ').slice(0, 19) }}
            </td>
            <td class="py-3.5 px-2 text-right">
              <button
                v-if="r.task"
                type="button"
                class="px-2 py-1 text-[10px] font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1"
                @click="goTask(r.task!.id)"
              >
                <ExternalLink class="w-3 h-3" /> 查看任务
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
