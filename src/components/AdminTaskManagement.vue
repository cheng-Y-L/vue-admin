<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ClipboardList,
  Search,
  Pencil,
  Ban,
  Loader2,
  X,
  Save,
  Eye,
} from '@lucide/vue'
import { isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/services/data'
import {
  fetchTasksForPublisher,
  updateTask,
  closeTask,
  validateTaskPayload,
  canEditTask,
  canAdminTakedownTask,
  type TaskFormPayload,
} from '@/services/task.service'
import { fetchPublisherBrief } from '@/services/task-application.service'
import { fetchActiveTaskTypeNames, fetchActiveTaskRegionNames } from '@/services/taxonomy.service'
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_CLASS,
  TASK_STATUS_DOT_CLASS,
  type TaskStatus,
} from '@/constants/tasks'
import type { Task, User, PublisherBrief } from '@/types'

const props = defineProps<{ currentUser: User }>()

type StatusFilter = 'all' | TaskStatus

const tasks = ref<Task[]>([])
const publishers = ref<Record<string, PublisherBrief>>({})
const taskTypes = ref<string[]>([])
const taskRegions = ref<string[]>([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref<StatusFilter>('all')
const submitting = ref(false)

const showForm = ref(false)
const editingTask = ref<Task | null>(null)
const title = ref('')
const taskType = ref('')
const region = ref('')
const description = ref('')
const budget = ref('')

onMounted(async () => {
  await Promise.all([loadTasks(), loadTaxonomy()])
})

async function loadTaxonomy() {
  const [types, regions] = await Promise.all([
    fetchActiveTaskTypeNames(),
    fetchActiveTaskRegionNames(),
  ])
  taskTypes.value = types
  taskRegions.value = regions
}

async function loadTasks() {
  loading.value = true
  if (isSupabaseConfigured()) {
    tasks.value = await fetchTasksForPublisher(props.currentUser.id, true)
  } else {
    tasks.value = db.getTasks()
  }

  const ids = [...new Set(tasks.value.map((t) => t.publisherId))]
  const briefs = await Promise.all(ids.map((id) => fetchPublisherBrief(id)))
  const map: Record<string, PublisherBrief> = {}
  ids.forEach((id, i) => {
    if (briefs[i]) map[id] = briefs[i]!
  })
  publishers.value = map
  loading.value = false
}

const filteredTasks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return tasks.value.filter((t) => {
    const pub = publishers.value[t.publisherId]
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.taskType.toLowerCase().includes(q) ||
      t.region.toLowerCase().includes(q) ||
      pub?.nickname.toLowerCase().includes(q) ||
      pub?.username.toLowerCase().includes(q)
    const matchesStatus = statusFilter.value === 'all' || t.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

function publisherLabel(id: string) {
  const p = publishers.value[id]
  return p ? `${p.nickname} (@${p.username})` : id.slice(0, 8)
}

function openEdit(task: Task) {
  if (!canEditTask(task, true)) {
    alert('已完成或已下架的任务不可编辑')
    return
  }
  editingTask.value = task
  title.value = task.title
  taskType.value = task.taskType
  region.value = task.region
  description.value = task.description
  budget.value = task.budget !== null ? String(task.budget) : ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingTask.value = null
}

function buildPayload(): TaskFormPayload {
  const budgetStr = String(budget.value ?? '').trim()
  const budgetNum = budgetStr ? parseFloat(budgetStr) : null
  return {
    title: title.value,
    taskType: taskType.value,
    region: region.value,
    description: description.value,
    budget: budgetNum,
    deadline: editingTask.value?.deadline ?? null,
    attachmentUrls: editingTask.value?.attachmentUrls ?? [],
  }
}

async function saveEdit() {
  if (!editingTask.value) return
  const payload = buildPayload()
  const err = validateTaskPayload(payload, editingTask.value.status !== 'draft')
  if (err) {
    alert(err)
    return
  }

  submitting.value = true
  db.addLog(
    props.currentUser.username,
    '管理员',
    `编辑任务: ${payload.title}`,
    'TaskManage',
    'success',
  )

  if (isSupabaseConfigured()) {
    const { task, error } = await updateTask(editingTask.value.id, payload)
    submitting.value = false
    if (error || !task) {
      alert(error ?? '保存失败')
      return
    }
  } else {
    tasks.value = tasks.value.map((t) =>
      t.id === editingTask.value!.id ? { ...t, ...payload, updatedAt: new Date().toISOString() } : t,
    )
    db.saveTasks(tasks.value)
    submitting.value = false
  }

  await loadTasks()
  closeForm()
}

async function handleTakedown(task: Task) {
  if (!canAdminTakedownTask(task)) return
  if (!confirm(`确定下架违规任务「${task.title}」？下架后任务将关闭且不可再承接。`)) return

  db.addLog(
    props.currentUser.username,
    '管理员',
    `下架任务: ${task.title}`,
    'TaskManage',
    'success',
  )

  if (isSupabaseConfigured()) {
    const { ok, error } = await closeTask(task.id)
    if (!ok) {
      alert(error ?? '下架失败')
      return
    }
  } else {
    tasks.value = tasks.value.map((t) =>
      t.id === task.id ? { ...t, status: 'closed' as const } : t,
    )
    db.saveTasks(tasks.value)
  }
  await loadTasks()
}

function formatBudget(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <ClipboardList class="w-5 h-5 text-slate-800" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">任务管理</h2>
          <p class="text-[11px] text-slate-500">查看全平台任务，编辑或下架违规任务</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <div class="relative flex-1 md:w-56">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索标题/类型/发布方..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
          />
        </div>
        <select v-model="statusFilter" class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
          <option value="all">全部状态</option>
          <option v-for="(label, key) in TASK_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
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
            <th class="py-3 px-2">发布方</th>
            <th class="py-3 px-2">类型/地域</th>
            <th class="py-3 px-2 text-right">预算</th>
            <th class="py-3 px-2 text-center">状态</th>
            <th class="py-3 px-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="!filteredTasks.length">
            <td colspan="6" class="py-8 text-center text-slate-400">无匹配任务</td>
          </tr>
          <tr v-for="t in filteredTasks" :key="t.id" class="hover:bg-slate-50/50" :class="t.status === 'closed' ? 'opacity-60' : ''">
            <td class="py-3.5 px-2">
              <span class="font-semibold block max-w-xs truncate">{{ t.title }}</span>
              <span class="text-[10px] text-slate-400 font-mono">{{ t.updatedAt.replace('T', ' ').slice(0, 19) }}</span>
            </td>
            <td class="py-3.5 px-2 text-[11px]">{{ publisherLabel(t.publisherId) }}</td>
            <td class="py-3.5 px-2">
              <span class="text-[11px] bg-slate-50 border px-1.5 py-0.5 rounded">{{ t.taskType }}</span>
              <span class="text-[11px] text-slate-500 ml-1">{{ t.region }}</span>
            </td>
            <td class="py-3.5 px-2 text-right font-mono font-bold">{{ formatBudget(t.budget) }}</td>
            <td class="py-3.5 px-2 text-center">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" :class="TASK_STATUS_CLASS[t.status]">
                <span class="w-1.5 h-1.5 rounded-full" :class="TASK_STATUS_DOT_CLASS[t.status]" />
                {{ TASK_STATUS_LABELS[t.status] }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-right">
              <div class="flex items-center justify-end gap-1">
                <button
                  v-if="canEditTask(t, true)"
                  type="button"
                  class="px-2 py-1 text-[10px] font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                  @click="openEdit(t)"
                >
                  <Pencil class="w-3 h-3" /> 编辑
                </button>
                <button
                  v-if="canAdminTakedownTask(t)"
                  type="button"
                  class="px-2 py-1 text-[10px] font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                  @click="handleTakedown(t)"
                >
                  <Ban class="w-3 h-3" /> 下架
                </button>
                <span v-if="t.status === 'closed'" class="text-[10px] text-slate-400 flex items-center gap-1">
                  <Eye class="w-3 h-3" /> 已下架
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showForm && editingTask"
          class="fixed inset-0 bg-slate-950/30 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          @click.self="closeForm"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full border max-h-[90vh] overflow-y-auto">
            <div class="p-5 border-b flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 class="font-space font-bold text-sm">编辑任务</h3>
                <p class="text-[11px] text-slate-500">发布方：{{ publisherLabel(editingTask.publisherId) }}</p>
              </div>
              <button type="button" class="p-1.5 hover:bg-slate-100 rounded-lg" @click="closeForm">
                <X class="w-4.5 h-4.5" />
              </button>
            </div>
            <form class="p-5 space-y-4" @submit.prevent="saveEdit">
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">标题</label>
                <input v-model="title" class="w-full text-xs border rounded-lg px-3 py-2" required />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[10px] text-slate-400 block mb-1">类型</label>
                  <select v-model="taskType" class="w-full text-xs border rounded-lg px-2 py-2">
                    <option v-for="tp in taskTypes" :key="tp" :value="tp">{{ tp }}</option>
                  </select>
                </div>
                <div>
                  <label class="text-[10px] text-slate-400 block mb-1">地域</label>
                  <select v-model="region" class="w-full text-xs border rounded-lg px-2 py-2">
                    <option v-for="rg in taskRegions" :key="rg" :value="rg">{{ rg }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">预算（留空为面议）</label>
                <input v-model="budget" type="number" min="0" class="w-full text-xs border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">描述</label>
                <textarea v-model="description" rows="4" class="w-full text-xs border rounded-lg px-3 py-2" />
              </div>
              <div class="flex gap-2 pt-2">
                <button
                  type="submit"
                  :disabled="submitting"
                  class="flex-1 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save class="w-4 h-4" /> 保存修改
                </button>
                <button type="button" class="px-4 py-2.5 border rounded-xl text-xs font-semibold" @click="closeForm">取消</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
