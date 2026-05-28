<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FolderOpen, Clock, CheckCircle2, History, ArrowRight, Undo2 } from '@lucide/vue'
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_CLASS,
  TASK_APPLICATION_STATUS_LABELS,
  TASK_APPLICATION_STATUS_CLASS,
} from '@/constants/tasks'
import { roleLabel as formatRoleLabel } from '@/constants/roles'
import { db } from '@/services/data'
import {
  fetchMyApplications,
  fetchMyAssignedTasks,
  withdrawApplication,
  type TaskApplicationWithTask,
} from '@/services/task-application.service'
import type { Task, User } from '@/types'

const props = defineProps<{ currentUser: User }>()

const router = useRouter()
const activeTab = ref<'applications' | 'active' | 'history'>('applications')
const applications = ref<TaskApplicationWithTask[]>([])
const assignedTasks = ref<Task[]>([])
const loading = ref(true)
const withdrawingId = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  const [apps, tasks] = await Promise.all([
    fetchMyApplications(props.currentUser.id),
    fetchMyAssignedTasks(props.currentUser.id),
  ])
  applications.value = apps
  assignedTasks.value = tasks
  loading.value = false
})

const activeTasks = computed(() =>
  assignedTasks.value.filter((t) =>
    t.status === 'in_progress' || t.status === 'awaiting_completion' || t.status === 'disputed',
  ),
)

const historyTasks = computed(() =>
  assignedTasks.value.filter((t) => t.status === 'completed' || t.status === 'closed'),
)

const pendingApplications = computed(() =>
  applications.value.filter((a) => a.status === 'pending'),
)

function formatBudget(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function openTaskDetail(taskId: string) {
  router.push({ name: 'my-task-detail', params: { id: taskId } })
}

async function handleWithdraw(app: TaskApplicationWithTask) {
  if (!confirm(`确定撤回对「${app.task?.title ?? '该任务'}」的申请？`)) return

  withdrawingId.value = app.id
  const { ok, error } = await withdrawApplication(app.id, props.currentUser.id)
  withdrawingId.value = null

  if (!ok) {
    alert(error ?? '撤回失败')
    return
  }

  applications.value = applications.value.map((a) =>
    a.id === app.id ? { ...a, status: 'withdrawn' as const } : a,
  )

  db.addLog(
    props.currentUser.username,
    formatRoleLabel(props.currentUser.role),
    `撤回任务申请: ${app.task?.title ?? app.taskId}`,
    'TaskManage',
    'success',
  )
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
      <div class="flex items-center gap-2">
        <FolderOpen class="w-5 h-5 text-slate-800 shrink-0" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">我的任务</h2>
          <p class="text-[11px] text-slate-500">管理申请记录、进行中任务与历史记录</p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="tab in [
            { key: 'applications', label: '我的申请', icon: Clock, count: applications.length },
            { key: 'active', label: '进行中', icon: CheckCircle2, count: activeTasks.length },
            { key: 'history', label: '历史任务', icon: History, count: historyTasks.length },
          ]"
          :key="tab.key"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          :class="
            activeTab === tab.key
              ? 'bg-slate-900 text-white'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          "
          @click="activeTab = tab.key as typeof activeTab"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          {{ tab.label }}
          <span class="opacity-70">({{ tab.count }})</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-slate-400 text-sm">加载中...</div>

    <!-- 我的申请 -->
    <div v-else-if="activeTab === 'applications'" class="space-y-3">
      <div
        v-if="pendingApplications.length"
        class="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800"
      >
        您有 {{ pendingApplications.length }} 条待审核申请。规则：每次只能申请一个任务，待审核期间不可申请其他任务。
      </div>

      <div v-if="!applications.length" class="py-16 text-center text-slate-400 text-sm bg-white border border-slate-100 rounded-2xl">
        暂无申请记录，前往任务大厅浏览开放任务
      </div>

      <article
        v-for="app in applications"
        :key="app.id"
        class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-bold text-sm text-slate-900 truncate">
                {{ app.task?.title ?? '任务已删除' }}
              </h3>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                :class="TASK_APPLICATION_STATUS_CLASS[app.status]"
              >
                {{ TASK_APPLICATION_STATUS_LABELS[app.status] }}
              </span>
            </div>
            <p v-if="app.task" class="text-[11px] text-slate-500 mt-1">
              {{ app.task.taskType }} · {{ app.task.region }} · 预算 {{ formatBudget(app.task.budget) }}
            </p>
            <p class="text-[11px] text-slate-600 mt-2 whitespace-pre-wrap line-clamp-2">{{ app.proposal }}</p>
            <p v-if="app.quote !== null" class="text-[11px] font-mono font-bold text-slate-800 mt-1">
              报价 {{ formatBudget(app.quote) }}
            </p>
            <p class="text-[10px] text-slate-400 font-mono mt-2">申请于 {{ formatDate(app.createdAt) }}</p>
          </div>

          <div class="flex flex-col gap-1.5 shrink-0">
            <button
              v-if="app.task"
              class="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer"
              @click="openTaskDetail(app.task!.id)"
            >
              查看
              <ArrowRight class="w-3 h-3" />
            </button>
            <button
              v-if="app.status === 'pending'"
              :disabled="withdrawingId === app.id"
              class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
              @click="handleWithdraw(app)"
            >
              <Undo2 class="w-3 h-3" />
              撤回
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- 进行中 -->
    <div v-else-if="activeTab === 'active'" class="space-y-3">
      <div v-if="!activeTasks.length" class="py-16 text-center text-slate-400 text-sm bg-white border border-slate-100 rounded-2xl">
        暂无进行中的任务
      </div>

      <article
        v-for="task in activeTasks"
        :key="task.id"
        class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:border-blue-200 transition cursor-pointer"
        @click="openTaskDetail(task.id)"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-bold"
              :class="TASK_STATUS_CLASS[task.status]"
            >
              {{ TASK_STATUS_LABELS[task.status] }}
            </span>
            <h3 class="font-bold text-sm text-slate-900 mt-1">{{ task.title }}</h3>
            <p class="text-[11px] text-slate-500 mt-1">
              {{ task.taskType }} · {{ task.region }} · {{ formatBudget(task.budget) }}
            </p>
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </article>
    </div>

    <!-- 历史 -->
    <div v-else class="space-y-3">
      <div v-if="!historyTasks.length" class="py-16 text-center text-slate-400 text-sm bg-white border border-slate-100 rounded-2xl">
        暂无历史任务记录
      </div>

      <article
        v-for="task in historyTasks"
        :key="task.id"
        class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs opacity-90 hover:opacity-100 transition cursor-pointer"
        @click="openTaskDetail(task.id)"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-bold"
              :class="TASK_STATUS_CLASS[task.status]"
            >
              {{ TASK_STATUS_LABELS[task.status] }}
            </span>
            <h3 class="font-bold text-sm text-slate-900 mt-1">{{ task.title }}</h3>
            <p class="text-[11px] text-slate-500 mt-1">
              {{ task.taskType }} · 完成于 {{ formatDate(task.updatedAt) }}
            </p>
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </article>
    </div>
  </div>
</template>
