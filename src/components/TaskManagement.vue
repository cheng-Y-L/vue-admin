<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ClipboardList,
  Search,
  Plus,
  Lock,
  XCircle,
  Pencil,
  Ban,
  Paperclip,
  Upload,
  Loader2,
  Send,
  Save,
  UserCheck,
  FileText,
} from '@lucide/vue'
import { roleLabel as formatRoleLabel, roleHasPermission } from '@/constants/roles'
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_CLASS,
  TASK_STATUS_DOT_CLASS,
  type TaskStatus,
} from '@/constants/tasks'
import { fetchActiveTaskTypeNames, fetchActiveTaskRegionNames } from '@/services/taxonomy.service'
import { isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/services/data'
import {
  fetchTasksForPublisher,
  createTask,
  updateTask,
  closeTask,
  uploadTaskAttachment,
  validateTaskPayload,
  canEditTask,
  canCloseTask,
  type TaskFormPayload,
} from '@/services/task.service'
import { fetchPendingApplicationCounts } from '@/services/task-application.service'
import { fetchSubmissionCountsByTask } from '@/services/task-submission.service'
import TaskApplicationReview from '@/components/TaskApplicationReview.vue'
import TaskDeliveryReview from '@/components/TaskDeliveryReview.vue'
import { formatLocalDateTime } from '@/utils/datetime'
import type { Task, User } from '@/types'

const props = defineProps<{ currentUser: User }>()

type StatusFilter = 'all' | TaskStatus

const tasks = ref<Task[]>([])
const searchQuery = ref('')
const statusFilter = ref<StatusFilter>('all')
const showForm = ref(false)
const editingTaskId = ref<string | null>(null)
const submitting = ref(false)
const uploading = ref(false)

const title = ref('')
const taskTypes = ref<string[]>([])
const taskRegions = ref<string[]>([])
const taskType = ref('')
const region = ref('')
const description = ref('')
const budget = ref('')
const deadline = ref('')
const attachmentUrls = ref<string[]>([])
const pendingFiles = ref<File[]>([])

const pendingAppCounts = ref<Record<string, number>>({})
const submissionCounts = ref<Record<string, number>>({})
const reviewTask = ref<Task | null>(null)
const showReview = ref(false)
const deliveryTask = ref<Task | null>(null)
const showDeliveryReview = ref(false)

const DELIVERY_VIEW_STATUSES: TaskStatus[] = ['in_progress', 'awaiting_completion', 'disputed', 'completed']

function canViewDelivery(task: Task) {
  return !!task.assignedLawyerId && DELIVERY_VIEW_STATUSES.includes(task.status)
}

const canManage = computed(() =>
  roleHasPermission(props.currentUser.role, props.currentUser.permissions, 'task_manage'),
)
const currentRoleLabel = computed(() => formatRoleLabel(props.currentUser.role))
const isEditing = computed(() => !!editingTaskId.value)

onMounted(() => {
  loadTaxonomy()
  loadTasks()
})

async function loadTaxonomy() {
  const [types, regions] = await Promise.all([
    fetchActiveTaskTypeNames(),
    fetchActiveTaskRegionNames(),
  ])
  taskTypes.value = types
  taskRegions.value = regions
  if (!taskType.value && types[0]) taskType.value = types[0]
  if (!region.value && regions[0]) region.value = regions[0]
}

async function loadTasks() {
  if (isSupabaseConfigured()) {
    const isAdmin = props.currentUser.role === 'admin'
    tasks.value = await fetchTasksForPublisher(props.currentUser.id, isAdmin)
  } else {
    tasks.value = db
      .getTasks()
      .filter((t) => t.publisherId === props.currentUser.id || t.publisherId === 'demo_publisher')
  }
  await loadPendingCounts()
}

async function loadPendingCounts() {
  const pendingTaskIds = tasks.value.filter((t) => t.status === 'pending').map((t) => t.id)
  const deliveryTaskIds = tasks.value.filter((t) => canViewDelivery(t)).map((t) => t.id)
  const [appCounts, subCounts] = await Promise.all([
    fetchPendingApplicationCounts(pendingTaskIds),
    fetchSubmissionCountsByTask(deliveryTaskIds),
  ])
  pendingAppCounts.value = appCounts
  submissionCounts.value = subCounts
}

function openApplicationReview(task: Task) {
  reviewTask.value = task
  showReview.value = true
}

function closeApplicationReview() {
  showReview.value = false
  reviewTask.value = null
}

async function handleApplicationReviewed() {
  await loadTasks()
  db.addLog(
    props.currentUser.username,
    currentRoleLabel.value,
    `审核律师申请: ${reviewTask.value?.title ?? '任务'}`,
    'TaskManage',
    'success',
  )
}

function openDeliveryReview(task: Task) {
  deliveryTask.value = task
  showDeliveryReview.value = true
}

function closeDeliveryReview() {
  showDeliveryReview.value = false
  deliveryTask.value = null
}

async function handleDeliveryReviewed() {
  await loadTasks()
  db.addLog(
    props.currentUser.username,
    currentRoleLabel.value,
    `审阅任务交付: ${deliveryTask.value?.title ?? '任务'}`,
    'TaskManage',
    'success',
  )
}

const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return tasks.value.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(query) ||
      t.taskType.toLowerCase().includes(query) ||
      t.region.toLowerCase().includes(query)
    const matchesStatus = statusFilter.value === 'all' || t.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

const taskStats = computed(() => ({
  draft: tasks.value.filter((t) => t.status === 'draft').length,
  pending: tasks.value.filter((t) => t.status === 'pending').length,
  inProgress: tasks.value.filter((t) => t.status === 'in_progress').length,
  awaitingCompletion: tasks.value.filter((t) => t.status === 'awaiting_completion').length,
  disputed: tasks.value.filter((t) => t.status === 'disputed').length,
  completed: tasks.value.filter((t) => t.status === 'completed').length,
  closed: tasks.value.filter((t) => t.status === 'closed').length,
}))

function resetForm() {
  title.value = ''
  taskType.value = taskTypes.value[0] ?? ''
  region.value = taskRegions.value[0] ?? ''
  description.value = ''
  budget.value = ''
  deadline.value = ''
  attachmentUrls.value = []
  pendingFiles.value = []
  editingTaskId.value = null
}

function openCreateForm() {
  if (!canManage.value) {
    alert('🔒 权限受限：您没有 [task_manage] 任务发布权限。')
    return
  }
  resetForm()
  showForm.value = true
}

function openEditForm(task: Task) {
  if (!canManage.value) return
  if (!canEditTask(task)) {
    alert('⚠️ 仅草稿或待承接状态的任务可编辑。')
    return
  }
  editingTaskId.value = task.id
  title.value = task.title
  taskType.value = task.taskType
  region.value = task.region
  description.value = task.description
  budget.value = task.budget !== null ? String(task.budget) : ''
  deadline.value = task.deadline ? task.deadline.slice(0, 16) : ''
  attachmentUrls.value = [...task.attachmentUrls]
  pendingFiles.value = []
  showForm.value = true
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
    deadline: deadline.value ? new Date(deadline.value).toISOString() : null,
    attachmentUrls: attachmentUrls.value,
  }
}

async function uploadPendingFiles(): Promise<string | null> {
  for (const file of pendingFiles.value) {
    uploading.value = true
    const { path, error } = await uploadTaskAttachment(props.currentUser.id, file)
    uploading.value = false
    if (error || !path) return error ?? '附件上传失败'
    attachmentUrls.value.push(path)
  }
  pendingFiles.value = []
  return null
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  pendingFiles.value.push(...Array.from(files))
  input.value = ''
}

function removePendingFile(index: number) {
  pendingFiles.value.splice(index, 1)
}

function removeAttachment(index: number) {
  attachmentUrls.value.splice(index, 1)
}

function attachmentDisplayName(path: string) {
  if (path.startsWith('local://')) return path.split('/').pop() ?? path
  return path.split('/').pop() ?? path
}

async function saveTask(publish: boolean) {
  if (!canManage.value) return

  const uploadError = await uploadPendingFiles()
  if (uploadError) {
    alert(uploadError)
    return
  }

  const payload = buildPayload()
  const validationError = validateTaskPayload(payload, publish)
  if (validationError) {
    alert(validationError)
    return
  }

  submitting.value = true
  const targetStatus = publish ? 'pending' : 'draft'

  if (isSupabaseConfigured()) {
    if (editingTaskId.value) {
      const { task, error } = await updateTask(editingTaskId.value, { ...payload, status: targetStatus })
      submitting.value = false
      if (error || !task) {
        alert(error ?? '保存失败')
        return
      }
      const idx = tasks.value.findIndex((t) => t.id === task.id)
      if (idx >= 0) tasks.value[idx] = task
      else tasks.value.unshift(task)
    } else {
      const { task, error } = await createTask(props.currentUser.id, payload, targetStatus)
      submitting.value = false
      if (error || !task) {
        alert(error ?? '创建失败')
        return
      }
      tasks.value.unshift(task)
    }
  } else {
    const now = formatLocalDateTime()
    if (editingTaskId.value) {
      tasks.value = tasks.value.map((t) =>
        t.id === editingTaskId.value
          ? { ...t, ...payload, status: targetStatus, updatedAt: now }
          : t,
      )
    } else {
      const newTask: Task = {
        id: `task_${Math.random().toString(36).substring(2, 9)}`,
        publisherId: props.currentUser.id,
        ...payload,
        status: targetStatus,
        createdAt: now,
        updatedAt: now,
      }
      tasks.value.unshift(newTask)
    }
    db.saveTasks(tasks.value)
    submitting.value = false
  }

  db.addLog(
    props.currentUser.username,
    currentRoleLabel.value,
    `${publish ? '发布' : '保存草稿'}任务: ${payload.title}`,
    'TaskManage',
    'success',
  )

  showForm.value = false
  resetForm()
}

async function handleCloseTask(task: Task) {
  if (!canManage.value || !canCloseTask(task)) return
  if (!confirm(`确定关闭任务「${task.title}」？`)) return

  if (isSupabaseConfigured()) {
    const { ok, error } = await closeTask(task.id)
    if (!ok) {
      alert(error ?? '关闭失败')
      return
    }
    const idx = tasks.value.findIndex((t) => t.id === task.id)
    if (idx >= 0) tasks.value[idx] = { ...tasks.value[idx], status: 'closed', updatedAt: new Date().toISOString() }
  } else {
    tasks.value = tasks.value.map((t) =>
      t.id === task.id ? { ...t, status: 'closed' as const, updatedAt: formatLocalDateTime() } : t,
    )
    db.saveTasks(tasks.value)
  }

  db.addLog(
    props.currentUser.username,
    currentRoleLabel.value,
    `关闭任务: ${task.title}`,
    'TaskManage',
    'success',
  )
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return '—'
  return deadline.replace('T', ' ').slice(0, 16)
}

function formatBudget(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}
</script>

<template>
  <div class="space-y-6">
    <!-- 控制面板 -->
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2 w-full md:w-auto">
        <ClipboardList class="w-5 h-5 text-slate-800 shrink-0" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">任务发布与管理</h2>
          <p class="text-[11px] text-slate-500">
            发布法律任务、管理草稿与承接状态。当前共 {{ tasks.length }} 条任务
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
        <div class="relative w-full sm:w-44 lg:w-56">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索标题/类型/地域..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all font-medium"
          />
        </div>

        <select
          v-model="statusFilter"
          class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
        >
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending">待承接</option>
          <option value="in_progress">进行中</option>
          <option value="awaiting_completion">待确认完成</option>
          <option value="disputed">争议中</option>
          <option value="completed">已完成</option>
          <option value="closed">已关闭</option>
        </select>

        <button
          class="px-3.5 py-1.5 bg-[#fa8231] hover:bg-[#fa8231]/95 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1 hover:shadow-xs active:scale-95 cursor-pointer"
          @click="openCreateForm"
        >
          <Plus class="w-3.5 h-3.5" />
          发布任务
        </button>
      </div>
    </div>

    <!-- 状态概览 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      <div
        v-for="item in [
          { label: '草稿', value: taskStats.draft, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100' },
          { label: '待承接', value: taskStats.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
          { label: '进行中', value: taskStats.inProgress, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
          { label: '待确认', value: taskStats.awaitingCompletion, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100' },
          { label: '争议中', value: taskStats.disputed, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
          { label: '已完成', value: taskStats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
          { label: '已关闭', value: taskStats.closed, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
        ]"
        :key="item.label"
        class="rounded-xl border p-3"
        :class="item.bg"
      >
        <span class="text-[10px] font-medium text-slate-500 block">{{ item.label }}</span>
        <span class="font-space font-bold text-xl mt-0.5" :class="item.color">{{ item.value }}</span>
      </div>
    </div>

    <!-- 只读提示 -->
    <div v-if="!canManage" class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
      <Lock class="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
      <div>
        <h4 class="text-xs font-semibold text-slate-700">只读模式</h4>
        <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          您缺少 <b>task_manage</b> 权限，可浏览任务列表但无法发布、编辑或关闭任务。
        </p>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse min-w-3xl">
        <thead>
          <tr class="border-b border-slate-150 text-slate-400 font-medium font-sans">
            <th class="py-3 px-2 w-[22%]">任务标题</th>
            <th class="py-3 px-2 w-[10%]">类型</th>
            <th class="py-3 px-2 w-[8%]">地域</th>
            <th class="py-3 px-2 w-[10%] text-right">预算</th>
            <th class="py-3 px-2 w-[12%]">截止日期</th>
            <th class="py-3 px-2 w-[8%] text-center">附件</th>
            <th class="py-3 px-2 w-[10%] text-center">状态</th>
            <th class="py-3 px-2 text-right w-[15%]">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50 text-slate-700 font-medium">
          <tr v-if="!filteredTasks.length">
            <td colspan="8" class="py-12 text-center text-slate-400 font-medium">
              暂无符合条件的任务，点击「发布任务」创建第一条。
            </td>
          </tr>
          <tr
            v-for="t in filteredTasks"
            :key="t.id"
            class="hover:bg-slate-50/40 transition-colors"
            :class="t.status === 'closed' ? 'bg-red-50/10' : ''"
          >
            <td class="py-3.5 px-2">
              <span class="font-bold text-slate-800 block truncate max-w-xs" :title="t.title">{{ t.title }}</span>
              <span class="font-mono text-[10px] text-slate-400 block mt-0.5">{{ t.updatedAt.replace('T', ' ').slice(0, 19) }}</span>
            </td>
            <td class="py-3.5 px-2">
              <span class="text-[11px] bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-sm">
                {{ t.taskType }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-slate-600">{{ t.region }}</td>
            <td class="py-3.5 px-2 text-right font-mono font-bold text-slate-900">{{ formatBudget(t.budget) }}</td>
            <td class="py-3.5 px-2 font-mono text-[11px] text-slate-500">{{ formatDeadline(t.deadline) }}</td>
            <td class="py-3.5 px-2 text-center">
              <span v-if="t.attachmentUrls.length" class="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
                <Paperclip class="w-3 h-3" />
                {{ t.attachmentUrls.length }}
              </span>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="py-3.5 px-2 text-center">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="TASK_STATUS_CLASS[t.status]"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="TASK_STATUS_DOT_CLASS[t.status]" />
                {{ TASK_STATUS_LABELS[t.status] }}
              </span>
            </td>
            <td class="py-3.5 px-2 text-right">
              <div class="flex gap-1.5 justify-end">
                <button
                  v-if="t.status === 'pending'"
                  :disabled="!canManage"
                  class="relative px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                  title="审核律师申请"
                  @click="openApplicationReview(t)"
                >
                  <UserCheck class="w-3 h-3" />
                  申请审核
                  <span
                    v-if="pendingAppCounts[t.id]"
                    class="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {{ pendingAppCounts[t.id] }}
                  </span>
                </button>
                <button
                  v-if="canViewDelivery(t)"
                  :disabled="!canManage"
                  class="relative px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                  title="查看过程与交付"
                  @click="openDeliveryReview(t)"
                >
                  <FileText class="w-3 h-3" />
                  过程交付
                  <span
                    v-if="submissionCounts[t.id]"
                    class="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-slate-700 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {{ submissionCounts[t.id] }}
                  </span>
                  <span
                    v-else-if="t.status === 'awaiting_completion'"
                    class="absolute -top-1.5 -right-1.5 w-2 h-2 bg-violet-500 rounded-full"
                    title="待确认完成"
                  />
                </button>
                <button
                  v-if="canEditTask(t)"
                  :disabled="!canManage"
                  class="px-2 py-1 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                  title="编辑任务"
                  @click="openEditForm(t)"
                >
                  <Pencil class="w-3 h-3" />
                  编辑
                </button>
                <button
                  v-if="canCloseTask(t)"
                  :disabled="!canManage"
                  class="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                  title="关闭任务"
                  @click="handleCloseTask(t)"
                >
                  <Ban class="w-3 h-3" />
                  关闭
                </button>
                <span
                  v-if="!canEditTask(t) && !canCloseTask(t) && t.status !== 'pending' && !canViewDelivery(t)"
                  class="text-[10px] text-slate-400 font-sans italic"
                >
                  无可用操作
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 发布/编辑弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showForm"
          class="fixed inset-0 bg-slate-950/30 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-lg w-full border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 class="font-space font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <ClipboardList class="w-5 h-5 text-slate-800" />
                {{ isEditing ? '编辑任务' : '发布新任务' }}
              </h3>
              <button class="p-1 hover:bg-slate-100 rounded text-slate-400" @click="showForm = false">
                <XCircle class="w-4.5 h-4.5" />
              </button>
            </div>

            <form class="space-y-4 text-left" @submit.prevent>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">任务标题 *</label>
                <input
                  v-model="title"
                  type="text"
                  placeholder="如：劳动合同纠纷代理"
                  required
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">任务类型 *</label>
                  <select
                    v-model="taskType"
                    class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                  >
                    <option v-for="tp in taskTypes" :key="tp" :value="tp">{{ tp }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">地域 *</label>
                  <select
                    v-model="region"
                    class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                  >
                    <option v-for="r in taskRegions" :key="r" :value="r">{{ r }}</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">任务描述</label>
                <textarea
                  v-model="description"
                  rows="4"
                  placeholder="请详细描述任务背景、诉求及期望..."
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden focus:border-slate-800 focus:bg-white transition resize-none"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">预算 (元)</label>
                  <input
                    v-model="budget"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="留空表示面议"
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">截止日期</label>
                  <input
                    v-model="deadline"
                    type="datetime-local"
                    class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">附件上传</label>
                <label class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition">
                  <Upload class="w-4 h-4 text-slate-400" />
                  <span class="text-xs text-slate-500">点击选择 PDF / Word / 图片（最大 10MB）</span>
                  <input type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" class="hidden" @change="handleFileSelect" />
                </label>

                <ul v-if="attachmentUrls.length || pendingFiles.length" class="mt-2 space-y-1">
                  <li
                    v-for="(path, i) in attachmentUrls"
                    :key="'saved-' + i"
                    class="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded"
                  >
                    <span class="flex items-center gap-1 truncate">
                      <Paperclip class="w-3 h-3 shrink-0" />
                      {{ attachmentDisplayName(path) }}
                    </span>
                    <button type="button" class="text-red-500 hover:text-red-700 shrink-0 ml-2" @click="removeAttachment(i)">
                      移除
                    </button>
                  </li>
                  <li
                    v-for="(file, i) in pendingFiles"
                    :key="'pending-' + i"
                    class="flex items-center justify-between text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded"
                  >
                    <span class="flex items-center gap-1 truncate">
                      <Paperclip class="w-3 h-3 shrink-0" />
                      {{ file.name }} (待上传)
                    </span>
                    <button type="button" class="text-red-500 hover:text-red-700 shrink-0 ml-2" @click="removePendingFile(i)">
                      移除
                    </button>
                  </li>
                </ul>
              </div>

              <div class="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
                  @click="showForm = false"
                >
                  取消
                </button>
                <button
                  type="button"
                  :disabled="submitting || uploading"
                  class="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  @click="saveTask(false)"
                >
                  <Loader2 v-if="submitting" class="w-3.5 h-3.5 animate-spin" />
                  <Save v-else class="w-3.5 h-3.5" />
                  保存草稿
                </button>
                <button
                  type="button"
                  :disabled="submitting || uploading"
                  class="px-3.5 py-1.5 bg-[#fa8231] hover:bg-[#fa8231]/95 text-white text-xs font-semibold rounded-lg transition shadow-md active:scale-95 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  @click="saveTask(true)"
                >
                  <Loader2 v-if="submitting || uploading" class="w-3.5 h-3.5 animate-spin" />
                  <Send v-else class="w-3.5 h-3.5" />
                  立即发布
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <TaskApplicationReview
      v-if="reviewTask"
      :task="reviewTask"
      :current-user="currentUser"
      :visible="showReview"
      @close="closeApplicationReview"
      @reviewed="handleApplicationReviewed"
    />

    <TaskDeliveryReview
      v-if="deliveryTask"
      :task="deliveryTask"
      :current-user="currentUser"
      :visible="showDeliveryReview"
      @close="closeDeliveryReview"
      @reviewed="handleDeliveryReviewed"
    />
  </div>
</template>
