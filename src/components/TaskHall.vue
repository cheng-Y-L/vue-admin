<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Briefcase, Search, MapPin, Clock, DollarSign, LayoutGrid, List } from '@lucide/vue'
import {
  TASK_PUBLISH_TIME_FILTERS,
  type TaskPublishTimeFilter,
} from '@/constants/tasks'
import { fetchActiveTaskTypeNames, fetchActiveTaskRegionNames } from '@/services/taxonomy.service'
import { fetchOpenTasksForLawyer } from '@/services/task-application.service'
import type { Task } from '@/types'

const router = useRouter()

const tasks = ref<Task[]>([])
const taskTypes = ref<string[]>([])
const taskRegions = ref<string[]>([])
const loading = ref(true)
const searchQuery = ref('')
const typeFilter = ref('all')
const regionFilter = ref('all')
const budgetMinInput = ref('')
const budgetMaxInput = ref('')
const budgetMin = ref('')
const budgetMax = ref('')
const publishTimeFilter = ref<TaskPublishTimeFilter>('all')
const viewMode = ref<'card' | 'list'>('card')

function parseBudgetInput(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : parseFloat(String(value).trim())
  return Number.isFinite(num) ? num : null
}

function hasBudgetInput(value: unknown): boolean {
  return parseBudgetInput(value) !== null
}

onMounted(async () => {
  loading.value = true
  const [openTasks, types, regions] = await Promise.all([
    fetchOpenTasksForLawyer(),
    fetchActiveTaskTypeNames(),
    fetchActiveTaskRegionNames(),
  ])
  tasks.value = openTasks
  taskTypes.value = types
  taskRegions.value = regions
  loading.value = false
})

const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const min = parseBudgetInput(budgetMin.value)
  const max = parseBudgetInput(budgetMax.value)
  const hasBudgetFilter = min !== null || max !== null
  const now = Date.now()
  const timeMs =
    publishTimeFilter.value === '7d'
      ? 7 * 24 * 60 * 60 * 1000
      : publishTimeFilter.value === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : null

  return tasks.value.filter((t) => {
    const matchesSearch =
      !query ||
      t.title.toLowerCase().includes(query) ||
      t.taskType.toLowerCase().includes(query) ||
      t.region.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)

    const matchesType = typeFilter.value === 'all' || t.taskType === typeFilter.value
    const matchesRegion = regionFilter.value === 'all' || t.region === regionFilter.value

    let matchesBudget = true
    if (hasBudgetFilter) {
      if (t.budget === null) {
        matchesBudget = false
      } else {
        if (min !== null) matchesBudget = t.budget >= min
        if (max !== null && matchesBudget) matchesBudget = t.budget <= max
      }
    }

    let matchesTime = true
    if (timeMs !== null) {
      const created = new Date(t.createdAt).getTime()
      matchesTime = !isNaN(created) && now - created <= timeMs
    }

    return matchesSearch && matchesType && matchesRegion && matchesBudget && matchesTime
  })
})

const hasActiveFilters = computed(
  () =>
    !!searchQuery.value.trim() ||
    typeFilter.value !== 'all' ||
    regionFilter.value !== 'all' ||
    hasBudgetInput(budgetMin.value) ||
    hasBudgetInput(budgetMax.value) ||
    publishTimeFilter.value !== 'all',
)

function applyBudgetFilter() {
  budgetMin.value = budgetMinInput.value
  budgetMax.value = budgetMaxInput.value
}

function resetFilters() {
  searchQuery.value = ''
  typeFilter.value = 'all'
  regionFilter.value = 'all'
  budgetMinInput.value = ''
  budgetMaxInput.value = ''
  budgetMin.value = ''
  budgetMax.value = ''
  publishTimeFilter.value = 'all'
}

function formatBudget(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function openDetail(taskId: string) {
  router.push({ name: 'task-detail', params: { id: taskId } })
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <Briefcase class="w-5 h-5 text-slate-800 shrink-0" />
          <div>
            <h2 class="font-space font-bold text-sm text-slate-900">任务大厅</h2>
            <p class="text-[11px] text-slate-500">
              浏览开放中的法律任务，共 {{ filteredTasks.length }} / {{ tasks.length }} 条可承接
              <span v-if="hasActiveFilters" class="text-[#fa8231] font-semibold"> · 筛选已生效</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="p-1.5 rounded-lg border transition cursor-pointer"
            :class="viewMode === 'card' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-slate-200'"
            title="卡片视图"
            @click="viewMode = 'card'"
          >
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button
            class="p-1.5 rounded-lg border transition cursor-pointer"
            :class="viewMode === 'list' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-slate-200'"
            title="列表视图"
            @click="viewMode = 'list'"
          >
            <List class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        <div class="relative lg:col-span-2">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索标题、类型、地域..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition font-medium"
          />
        </div>

        <select
          v-model="typeFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部类型</option>
          <option v-for="tp in taskTypes" :key="tp" :value="tp">{{ tp }}</option>
        </select>

        <select
          v-model="regionFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部地域</option>
          <option v-for="r in taskRegions" :key="r" :value="r">{{ r }}</option>
        </select>

        <input
          v-model="budgetMinInput"
          type="number"
          min="0"
          step="100"
          placeholder="预算下限"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
          @blur="applyBudgetFilter"
          @keyup.enter="($event.target as HTMLInputElement).blur()"
        />

        <input
          v-model="budgetMaxInput"
          type="number"
          min="0"
          step="100"
          placeholder="预算上限"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
          @blur="applyBudgetFilter"
          @keyup.enter="($event.target as HTMLInputElement).blur()"
        />

        <select
          v-model="publishTimeFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option v-for="item in TASK_PUBLISH_TIME_FILTERS" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </div>

      <div v-if="hasActiveFilters" class="mt-2 flex justify-end">
        <button
          type="button"
          class="px-3 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          @click="resetFilters"
        >
          重置筛选
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-slate-400 text-sm">加载任务中...</div>

    <div v-else-if="!filteredTasks.length" class="py-16 text-center text-slate-400 text-sm bg-white border border-slate-100 rounded-2xl">
      暂无符合条件的开放任务
    </div>

    <!-- 卡片视图 -->
    <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <article
        v-for="task in filteredTasks"
        :key="task.id"
        class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-200 transition cursor-pointer group"
        @click="openDetail(task.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-bold text-sm text-slate-900 group-hover:text-[#fa8231] transition line-clamp-2">
            {{ task.title }}
          </h3>
          <span class="shrink-0 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
            待承接
          </span>
        </div>

        <p class="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed min-h-[2.5rem]">
          {{ task.description || '暂无详细描述' }}
        </p>

        <div class="mt-4 flex flex-wrap gap-2 text-[10px]">
          <span class="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-600 px-2 py-0.5 rounded-sm">
            {{ task.taskType }}
          </span>
          <span class="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-600 px-2 py-0.5 rounded-sm">
            <MapPin class="w-3 h-3" />
            {{ task.region }}
          </span>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px]">
          <span class="inline-flex items-center gap-1 font-bold text-slate-900">
            <DollarSign class="w-3.5 h-3.5 text-emerald-600" />
            {{ formatBudget(task.budget) }}
          </span>
          <span class="inline-flex items-center gap-1 text-slate-400 font-mono">
            <Clock class="w-3.5 h-3.5" />
            {{ formatDate(task.createdAt) }}
          </span>
        </div>
      </article>
    </div>

    <!-- 列表视图 -->
    <div v-else class="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse min-w-3xl">
        <thead>
          <tr class="border-b border-slate-150 text-slate-400 font-medium">
            <th class="py-3 px-4">任务标题</th>
            <th class="py-3 px-2">类型</th>
            <th class="py-3 px-2">地域</th>
            <th class="py-3 px-2 text-right">预算</th>
            <th class="py-3 px-2">发布时间</th>
            <th class="py-3 px-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr
            v-for="task in filteredTasks"
            :key="task.id"
            class="hover:bg-slate-50/40 transition-colors cursor-pointer"
            @click="openDetail(task.id)"
          >
            <td class="py-3.5 px-4">
              <span class="font-bold text-slate-800 block">{{ task.title }}</span>
              <span class="text-[10px] text-slate-400 line-clamp-1">{{ task.description }}</span>
            </td>
            <td class="py-3.5 px-2">{{ task.taskType }}</td>
            <td class="py-3.5 px-2">{{ task.region }}</td>
            <td class="py-3.5 px-2 text-right font-mono font-bold">{{ formatBudget(task.budget) }}</td>
            <td class="py-3.5 px-2 font-mono text-slate-500">{{ formatDate(task.createdAt) }}</td>
            <td class="py-3.5 px-2 text-right">
              <button
                class="px-2.5 py-1 bg-[#fa8231] text-white rounded text-[10px] font-semibold hover:bg-[#fa8231]/90 cursor-pointer"
                @click.stop="openDetail(task.id)"
              >
                查看详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
