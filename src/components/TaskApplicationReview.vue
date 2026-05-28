<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  XCircle,
  ShieldCheck,
  DollarSign,
  FileText,
  CheckCircle2,
  Loader2,
  Inbox,
} from '@lucide/vue'
import { LAWYER_CERT_STATUS_LABELS } from '@/constants/lawyer-cert'
import {
  TASK_APPLICATION_STATUS_LABELS,
  TASK_APPLICATION_STATUS_CLASS,
} from '@/constants/tasks'
import { getLawyerLicenseSignedUrl } from '@/services/lawyer-cert.service'
import {
  fetchApplicationsForTask,
  reviewApplication,
  type TaskApplicationWithLawyer,
} from '@/services/task-application.service'
import type { Task, User } from '@/types'

const props = defineProps<{
  task: Task
  currentUser: User
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  reviewed: []
}>()

const applications = ref<TaskApplicationWithLawyer[]>([])
const loading = ref(false)
const reviewingId = ref<string | null>(null)
const licensePreviews = ref<Record<string, string>>({})

watch(
  () => [props.visible, props.task.id] as const,
  ([visible]) => {
    if (visible) loadApplications()
  },
  { immediate: true },
)

async function loadApplications() {
  loading.value = true
  licensePreviews.value = {}
  applications.value = await fetchApplicationsForTask(props.task.id)
  await loadLicensePreviews()
  loading.value = false
}

async function loadLicensePreviews() {
  const previews: Record<string, string> = {}
  for (const app of applications.value) {
    const path = app.lawyer?.licenseImageUrl
    if (!path) continue
    if (path.startsWith('local://') || path.startsWith('http')) {
      previews[app.id] = path
      continue
    }
    const signed = await getLawyerLicenseSignedUrl(path)
    if (signed) previews[app.id] = signed
  }
  licensePreviews.value = previews
}

function formatQuote(amount: number | null) {
  if (amount === null) return '面议'
  return `¥${amount.toLocaleString()}`
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function certBadgeClass(status: string) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-100'
  if (status === 'rejected') return 'bg-red-50 text-red-600 border-red-100'
  return 'bg-slate-50 text-slate-500 border-slate-100'
}

async function handleReview(app: TaskApplicationWithLawyer, decision: 'accepted' | 'rejected') {
  const lawyerName = app.lawyer?.realName || app.lawyer?.nickname || '该律师'
  const actionLabel = decision === 'accepted' ? '通过' : '驳回'
  const confirmMsg =
    decision === 'accepted'
      ? `确定通过 ${lawyerName} 的申请？通过后任务将进入进行中，其他待审申请将自动驳回。`
      : `确定驳回 ${lawyerName} 的申请？`

  if (!confirm(confirmMsg)) return

  reviewingId.value = app.id
  const isAdmin = props.currentUser.role === 'admin'
  const { ok, error } = await reviewApplication(app.id, props.currentUser.id, decision, isAdmin)
  reviewingId.value = null

  if (!ok) {
    alert(error ?? `${actionLabel}失败`)
    return
  }

  emit('reviewed')
  if (decision === 'accepted') {
    emit('close')
  } else {
    await loadApplications()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 bg-slate-950/30 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-100 max-h-[90vh] flex flex-col"
        >
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
            <div>
              <h3 class="font-space font-bold text-sm text-slate-900">律师申请审核</h3>
              <p class="text-[11px] text-slate-500 mt-0.5 truncate max-w-md" :title="task.title">
                任务：{{ task.title }}
              </p>
            </div>
            <button class="p-1 hover:bg-slate-100 rounded text-slate-400" @click="emit('close')">
              <XCircle class="w-4.5 h-4.5" />
            </button>
          </div>

          <div class="overflow-y-auto flex-1 px-6 py-4">
            <div v-if="loading" class="py-16 flex flex-col items-center text-slate-400">
              <Loader2 class="w-6 h-6 animate-spin mb-2" />
              <span class="text-xs">加载申请列表…</span>
            </div>

            <div v-else-if="!applications.length" class="py-16 flex flex-col items-center text-slate-400">
              <Inbox class="w-10 h-10 mb-3 opacity-40" />
              <p class="text-xs font-medium">暂无律师申请</p>
              <p class="text-[11px] mt-1">律师在任务大厅提交申请后，将显示在此处</p>
            </div>

            <div v-else class="space-y-4">
              <article
                v-for="app in applications"
                :key="app.id"
                class="border border-slate-100 rounded-xl overflow-hidden"
                :class="app.status === 'pending' ? 'ring-1 ring-amber-100' : ''"
              >
                <div class="flex items-start gap-3 p-4 bg-slate-50/60 border-b border-slate-100">
                  <img
                    :src="app.lawyer?.avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.lawyerId}`"
                    :alt="app.lawyer?.nickname ?? '律师'"
                    class="w-10 h-10 rounded-full border border-slate-200 bg-white shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-bold text-sm text-slate-800">
                        {{ app.lawyer?.realName || app.lawyer?.nickname || '未知律师' }}
                      </span>
                      <span class="text-[10px] text-slate-400 font-mono">@{{ app.lawyer?.username }}</span>
                      <span
                        class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                        :class="TASK_APPLICATION_STATUS_CLASS[app.status]"
                      >
                        {{ TASK_APPLICATION_STATUS_LABELS[app.status] }}
                      </span>
                    </div>
                    <p v-if="app.lawyer?.lawFirm" class="text-[11px] text-slate-500 mt-0.5">
                      {{ app.lawyer.lawFirm }}
                    </p>
                  </div>
                  <span class="text-[10px] text-slate-400 font-mono shrink-0">{{ formatDate(app.createdAt) }}</span>
                </div>

                <div class="p-4 space-y-3">
                  <section v-if="app.lawyer">
                    <div class="flex items-center gap-1.5 mb-2">
                      <ShieldCheck class="w-3.5 h-3.5 text-slate-500" />
                      <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">律师资质</h4>
                      <span
                        class="ml-auto inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        :class="certBadgeClass(app.lawyer.certificationStatus)"
                      >
                        {{ LAWYER_CERT_STATUS_LABELS[app.lawyer.certificationStatus] }}
                      </span>
                    </div>
                    <dl class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <div>
                        <dt class="text-slate-400">执业证号</dt>
                        <dd class="font-mono font-medium text-slate-700">{{ app.lawyer.licenseNumber || '—' }}</dd>
                      </div>
                      <div>
                        <dt class="text-slate-400">执业领域</dt>
                        <dd class="font-medium text-slate-700">{{ app.lawyer.practiceArea || '—' }}</dd>
                      </div>
                    </dl>
                    <div v-if="licensePreviews[app.id]" class="mt-2">
                      <a
                        :href="licensePreviews[app.id]"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block"
                      >
                        <img
                          :src="licensePreviews[app.id]"
                          alt="律师执业证"
                          class="w-full max-h-32 object-contain rounded-lg border border-slate-200 bg-white"
                        />
                      </a>
                    </div>
                  </section>

                  <section>
                    <div class="flex items-center gap-1.5 mb-1.5">
                      <FileText class="w-3.5 h-3.5 text-slate-500" />
                      <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">承接方案</h4>
                    </div>
                    <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg p-3">
                      {{ app.proposal }}
                    </p>
                  </section>

                  <section class="flex items-center gap-2">
                    <DollarSign class="w-3.5 h-3.5 text-slate-500" />
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">报价</span>
                    <span class="text-sm font-mono font-bold text-slate-900 ml-1">{{ formatQuote(app.quote) }}</span>
                  </section>

                  <div
                    v-if="app.status === 'pending' && task.status === 'pending' && !task.assignedLawyerId"
                    class="flex gap-2 pt-3 border-t border-slate-100"
                  >
                    <button
                      type="button"
                      :disabled="!!reviewingId"
                      class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      @click="handleReview(app, 'accepted')"
                    >
                      <Loader2 v-if="reviewingId === app.id" class="w-3.5 h-3.5 animate-spin" />
                      <CheckCircle2 v-else class="w-3.5 h-3.5" />
                      通过申请
                    </button>
                    <button
                      type="button"
                      :disabled="!!reviewingId"
                      class="flex-1 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      @click="handleReview(app, 'rejected')"
                    >
                      <Loader2 v-if="reviewingId === app.id" class="w-3.5 h-3.5 animate-spin" />
                      <XCircle v-else class="w-3.5 h-3.5" />
                      驳回
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div class="border-t border-slate-100 px-6 py-3 shrink-0 flex justify-end">
            <button
              type="button"
              class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
              @click="emit('close')"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
