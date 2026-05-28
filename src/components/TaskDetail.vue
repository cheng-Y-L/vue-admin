<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Paperclip,
  UserRound,
  Send,
  Loader2,
  AlertCircle,
  ExternalLink,
} from '@lucide/vue'
import { roleLabel as formatRoleLabel } from '@/constants/roles'
import { TASK_STATUS_LABELS } from '@/constants/tasks'
import { isSupabaseConfigured } from '@/lib/supabase'
import { db } from '@/services/data'
import { getTaskAttachmentSignedUrl } from '@/services/task.service'
import {
  fetchTaskForLawyer,
  fetchPublisherBrief,
  fetchApplicationForTask,
  getLawyerTaskConstraints,
  applyForTask,
  withdrawApplication,
} from '@/services/task-application.service'
import TaskProgressPanel from '@/components/TaskProgressPanel.vue'
import type { Task, TaskApplication, PublisherBrief, User } from '@/types'

const props = defineProps<{ currentUser: User }>()

const route = useRoute()
const router = useRouter()

const task = ref<Task | null>(null)
const publisher = ref<PublisherBrief | null>(null)
const existingApplication = ref<TaskApplication | null>(null)
const constraints = ref<Awaited<ReturnType<typeof getLawyerTaskConstraints>> | null>(null)
const loading = ref(true)
const submitting = ref(false)
const attachmentLinks = ref<Record<string, string>>({})

const showApplyForm = ref(false)
const proposal = ref('')
const quote = ref('')

const taskId = computed(() => route.params.id as string)

const isAssignedLawyer = computed(
  () => !!task.value && task.value.assignedLawyerId === props.currentUser.id,
)

const canApply = computed(() => {
  if (!task.value || task.value.status !== 'pending' || task.value.assignedLawyerId) return false
  if (existingApplication.value) return false
  return constraints.value?.canApply ?? false
})

const applyBlockReason = computed(() => {
  if (existingApplication.value) {
    return existingApplication.value.status === 'pending'
      ? '您已提交申请，请等待发布方审核'
      : '您已申请过该任务'
  }
  if (task.value && task.value.status !== 'pending') return '该任务已关闭承接'
  return constraints.value?.blockReason
})

onMounted(() => loadDetail())
watch(taskId, () => loadDetail())

async function loadDetail() {
  loading.value = true
  attachmentLinks.value = {}

  const [taskData, appData, constraintData] = await Promise.all([
    fetchTaskForLawyer(taskId.value),
    fetchApplicationForTask(props.currentUser.id, taskId.value),
    getLawyerTaskConstraints(props.currentUser.id),
  ])

  task.value = taskData
  existingApplication.value = appData
  constraints.value = constraintData

  if (taskData) {
    publisher.value = await fetchPublisherBrief(taskData.publisherId)
    await loadAttachmentUrls(taskData.attachmentUrls)
  }

  loading.value = false
}

async function loadAttachmentUrls(paths: string[]) {
  const links: Record<string, string> = {}
  for (const path of paths) {
    if (path.startsWith('local://')) {
      links[path] = path
      continue
    }
    const url = await getTaskAttachmentSignedUrl(path)
    if (url) links[path] = url
  }
  attachmentLinks.value = links
}

function formatBudget(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function attachmentName(path: string) {
  if (path.startsWith('local://')) return path.split('/').pop() ?? path
  return path.split('/').pop() ?? path
}

async function handleApply() {
  if (!canApply.value) return

  const raw = quote.value
  const quoteNum =
    raw === '' || raw === null || raw === undefined
      ? null
      : typeof raw === 'number'
        ? (Number.isFinite(raw) ? raw : null)
        : (() => {
            const s = String(raw).trim()
            return s ? parseFloat(s) : null
          })()

  submitting.value = true
  const { application, error } = await applyForTask(props.currentUser.id, taskId.value, {
    proposal: proposal.value,
    quote: quoteNum,
  })
  submitting.value = false

  if (error || !application) {
    alert(error ?? '申请失败')
    return
  }

  existingApplication.value = application
  constraints.value = await getLawyerTaskConstraints(props.currentUser.id)
  showApplyForm.value = false
  proposal.value = ''
  quote.value = ''

  db.addLog(
    props.currentUser.username,
    formatRoleLabel(props.currentUser.role),
    `申请承接任务: ${task.value?.title ?? taskId.value}`,
    'TaskManage',
    'success',
  )
}

async function handleWithdraw() {
  if (!existingApplication.value || existingApplication.value.status !== 'pending') return
  if (!confirm('确定撤回该任务的申请？撤回后可申请其他任务。')) return

  submitting.value = true
  const { ok, error } = await withdrawApplication(existingApplication.value.id, props.currentUser.id)
  submitting.value = false

  if (!ok) {
    alert(error ?? '撤回失败')
    return
  }

  existingApplication.value = null
  constraints.value = await getLawyerTaskConstraints(props.currentUser.id)

  db.addLog(
    props.currentUser.username,
    formatRoleLabel(props.currentUser.role),
    `撤回任务申请: ${task.value?.title ?? taskId.value}`,
    'TaskManage',
    'success',
  )
}

function goBack() {
  if (route.query.from === 'orders' || route.name === 'order-task-detail') {
    router.push({ name: 'orders' })
    return
  }
  const fromMyTasks = route.name === 'my-task-detail' || isAssignedLawyer.value
  router.push({ name: fromMyTasks ? 'my-tasks' : 'task-hall' })
}

const backLabel = computed(() => {
  if (route.query.from === 'orders' || route.name === 'order-task-detail') {
    return '返回收支履约管理'
  }
  if (route.name === 'my-task-detail' || isAssignedLawyer.value) {
    return '返回我的任务'
  }
  return '返回任务大厅'
})

async function handleTaskUpdated() {
  const taskData = await fetchTaskForLawyer(taskId.value)
  if (taskData) task.value = taskData
}
</script>

<template>
  <div class="space-y-6">
    <button
      class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
      @click="goBack"
    >
      <ArrowLeft class="w-4 h-4" />
      {{ backLabel }}
    </button>

    <div v-if="loading" class="py-20 text-center text-slate-400 text-sm">加载任务详情...</div>

    <div v-else-if="!task" class="py-20 text-center text-slate-400 text-sm bg-white border border-slate-100 rounded-2xl">
      任务不存在或无权查看
    </div>

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 主内容 -->
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
            <div class="flex items-start justify-between gap-4">
              <div>
                <span class="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  {{ TASK_STATUS_LABELS[task.status] }}
                </span>
                <h1 class="font-space font-bold text-lg text-slate-900 mt-2">{{ task.title }}</h1>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span class="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                类型：{{ task.taskType }}
              </span>
              <span class="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                <MapPin class="w-3.5 h-3.5" />
                {{ task.region }}
              </span>
              <span class="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                <DollarSign class="w-3.5 h-3.5 text-emerald-600" />
                {{ formatBudget(task.budget) }}
              </span>
              <span class="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                <Calendar class="w-3.5 h-3.5" />
                截止 {{ formatDateTime(task.deadline) }}
              </span>
            </div>

            <div class="mt-6">
              <h3 class="text-xs font-bold text-slate-700 mb-2">任务描述</h3>
              <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {{ task.description || '发布方未填写详细描述' }}
              </p>
            </div>

            <div v-if="task.attachmentUrls.length" class="mt-6">
              <h3 class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                <Paperclip class="w-3.5 h-3.5" />
                附件 ({{ task.attachmentUrls.length }})
              </h3>
              <ul class="space-y-2">
                <li
                  v-for="path in task.attachmentUrls"
                  :key="path"
                  class="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg"
                >
                  <span class="truncate">{{ attachmentName(path) }}</span>
                  <a
                    v-if="attachmentLinks[path]"
                    :href="attachmentLinks[path]"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-[#fa8231] font-semibold hover:underline shrink-0 ml-2"
                  >
                    查看
                    <ExternalLink class="w-3 h-3" />
                  </a>
                  <span v-else-if="!isSupabaseConfigured() && path.startsWith('local://')" class="text-slate-400 text-[10px]">
                    本地演示文件
                  </span>
                </li>
              </ul>
            </div>

            <p class="mt-6 text-[10px] text-slate-400 font-mono">
              发布于 {{ formatDateTime(task.createdAt) }} · 更新于 {{ formatDateTime(task.updatedAt) }}
            </p>
          </div>

          <TaskProgressPanel
            v-if="isAssignedLawyer"
            :task="task"
            :current-user="currentUser"
            @updated="handleTaskUpdated"
          />
        </div>

        <!-- 侧边栏 -->
        <div class="space-y-4">
          <!-- 发布方信息 -->
          <div v-if="publisher" class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <h3 class="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1">
              <UserRound class="w-4 h-4" />
              发布方信息
            </h3>
            <div class="flex items-center gap-3">
              <img
                :src="publisher.avatar"
                :alt="publisher.nickname"
                class="w-10 h-10 rounded-full object-cover border border-slate-100"
                referrerpolicy="no-referrer"
              />
              <div>
                <span class="text-sm font-bold text-slate-900 block">{{ publisher.nickname }}</span>
                <span class="text-[10px] text-slate-500">@{{ publisher.username }} · 发布侧</span>
              </div>
            </div>
          </div>

          <!-- 申请操作（非承接律师可见） -->
          <div v-if="!isAssignedLawyer" class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <h3 class="text-xs font-bold text-slate-700 mb-3">承接申请</h3>

            <div
              v-if="applyBlockReason && !existingApplication"
              class="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2"
            >
              <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p class="text-[11px] text-amber-800 leading-relaxed">{{ applyBlockReason }}</p>
            </div>

            <div v-if="existingApplication" class="space-y-3">
              <div class="p-3 bg-slate-50 rounded-lg text-[11px] space-y-1">
                <p><span class="text-slate-500">申请状态：</span>{{ existingApplication.status === 'pending' ? '待审核' : existingApplication.status === 'accepted' ? '已中标' : existingApplication.status }}</p>
                <p v-if="existingApplication.quote !== null">
                  <span class="text-slate-500">您的报价：</span>¥{{ existingApplication.quote.toLocaleString() }}
                </p>
                <p class="text-slate-600 whitespace-pre-wrap">{{ existingApplication.proposal }}</p>
              </div>
              <button
                v-if="existingApplication.status === 'pending'"
                :disabled="submitting"
                class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
                @click="handleWithdraw"
              >
                撤回申请
              </button>
            </div>

            <template v-else-if="canApply">
              <button
                v-if="!showApplyForm"
                class="w-full py-2.5 bg-[#fa8231] hover:bg-[#fa8231]/95 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                @click="showApplyForm = true"
              >
                <Send class="w-4 h-4" />
                申请承接
              </button>

              <form v-else class="space-y-3" @submit.prevent="handleApply">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">方案简述 *</label>
                  <textarea
                    v-model="proposal"
                    rows="4"
                    placeholder="简要说明您的执业经验、处理思路与时间规划..."
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 resize-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">报价 (元)</label>
                  <input
                    v-model="quote"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="留空表示面议"
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                    @click="showApplyForm = false"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    :disabled="submitting"
                    class="flex-1 py-2 bg-[#fa8231] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Loader2 v-if="submitting" class="w-3.5 h-3.5 animate-spin" />
                    提交申请
                  </button>
                </div>
              </form>
            </template>

            <p v-else-if="!existingApplication" class="text-[11px] text-slate-400 text-center py-2">
              当前不可申请该任务
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
