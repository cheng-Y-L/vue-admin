<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Paperclip,
  ExternalLink,
  RotateCcw,
  UserRound,
  Inbox,
} from '@lucide/vue'
import { TASK_SUBMISSION_TYPE_LABELS, TASK_STATUS_LABELS } from '@/constants/tasks'
import {
  getTaskAttachmentSignedUrl,
  confirmTaskCompletion,
  disputeTask,
  reopenDisputedTask,
} from '@/services/task.service'
import { fetchTaskSubmissions } from '@/services/task-submission.service'
import { fetchLawyerBrief } from '@/services/task-application.service'
import type { Task, TaskSubmission, LawyerBrief, User } from '@/types'

const props = defineProps<{
  task: Task
  currentUser: User
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  reviewed: []
}>()

const submissions = ref<TaskSubmission[]>([])
const lawyer = ref<LawyerBrief | null>(null)
const loading = ref(false)
const acting = ref(false)
const attachmentLinks = ref<Record<string, string>>({})

/** 按时间正序展示，便于按阶段阅读 */
const timelineSubmissions = computed(() =>
  [...submissions.value].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
)
const progressSubmissions = computed(() =>
  timelineSubmissions.value.filter((s) => s.submissionType === 'progress'),
)

function progressStageIndex(sub: TaskSubmission) {
  const idx = progressSubmissions.value.findIndex((s) => s.id === sub.id)
  return idx >= 0 ? idx + 1 : null
}

watch(
  () => [props.visible, props.task.id] as const,
  ([visible]) => {
    if (visible) loadData()
  },
  { immediate: true },
)

async function loadData() {
  loading.value = true
  const [subs, lawyerData] = await Promise.all([
    fetchTaskSubmissions(props.task.id),
    props.task.assignedLawyerId ? fetchLawyerBrief(props.task.assignedLawyerId) : Promise.resolve(null),
  ])
  submissions.value = subs
  lawyer.value = lawyerData
  await loadAttachmentLinks()
  loading.value = false
}

async function loadAttachmentLinks() {
  const links: Record<string, string> = {}
  for (const sub of submissions.value) {
    for (const path of sub.attachmentUrls) {
      if (links[path]) continue
      if (path.startsWith('local://') || path.startsWith('http')) {
        links[path] = path
        continue
      }
      const url = await getTaskAttachmentSignedUrl(path)
      if (url) links[path] = url
    }
  }
  attachmentLinks.value = links
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function attachmentName(path: string) {
  return path.split('/').pop() ?? path
}

async function handleConfirm() {
  if (!confirm(`确定确认任务「${props.task.title}」已完成？`)) return
  acting.value = true
  const isAdmin = props.currentUser.role === 'admin'
  const { ok, error } = await confirmTaskCompletion(props.task.id, props.currentUser.id, isAdmin)
  acting.value = false
  if (!ok) {
    alert(error ?? '确认失败')
    return
  }
  emit('reviewed')
  emit('close')
}

async function handleDispute() {
  if (!confirm(`确定对任务「${props.task.title}」提出争议？`)) return
  acting.value = true
  const isAdmin = props.currentUser.role === 'admin'
  const { ok, error } = await disputeTask(props.task.id, props.currentUser.id, isAdmin)
  acting.value = false
  if (!ok) {
    alert(error ?? '操作失败')
    return
  }
  emit('reviewed')
  emit('close')
}

async function handleReopen() {
  if (!confirm(`确定将争议任务「${props.task.title}」退回进行中？`)) return
  acting.value = true
  const isAdmin = props.currentUser.role === 'admin'
  const { ok, error } = await reopenDisputedTask(props.task.id, props.currentUser.id, isAdmin)
  acting.value = false
  if (!ok) {
    alert(error ?? '操作失败')
    return
  }
  emit('reviewed')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 bg-slate-950/30 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      >
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-100 max-h-[90vh] flex flex-col min-h-0">
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
            <div>
              <h3 class="font-space font-bold text-sm text-slate-900">过程与交付</h3>
              <p class="text-[11px] text-slate-500 mt-0.5 truncate max-w-md" :title="task.title">
                {{ task.title }} · {{ TASK_STATUS_LABELS[task.status] }}
              </p>
            </div>
            <button class="p-1 hover:bg-slate-100 rounded text-slate-400" @click="emit('close')">
              <XCircle class="w-4.5 h-4.5" />
            </button>
          </div>

          <div class="overflow-y-auto flex-1 min-h-0 px-6 py-4 space-y-4">
            <div v-if="loading" class="py-16 flex flex-col items-center text-slate-400">
              <Loader2 class="w-6 h-6 animate-spin mb-2" />
              <span class="text-xs">加载过程记录…</span>
            </div>

            <template v-else>
              <section v-if="lawyer" class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <img
                  :src="lawyer.avatar"
                  :alt="lawyer.nickname"
                  class="w-10 h-10 rounded-full border border-slate-200 bg-white shrink-0"
                />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <UserRound class="w-3.5 h-3.5 text-slate-400" />
                    <span class="text-xs font-bold text-slate-800">承接律师</span>
                  </div>
                  <p class="text-sm font-bold text-slate-900 mt-0.5">
                    {{ lawyer.realName || lawyer.nickname }}
                  </p>
                  <p class="text-[10px] text-slate-500">
                    @{{ lawyer.username }}
                    <span v-if="lawyer.lawFirm"> · {{ lawyer.lawFirm }}</span>
                  </p>
                </div>
              </section>

              <div
                v-if="task.status === 'awaiting_completion'"
                class="p-3 bg-violet-50 border border-violet-100 rounded-lg text-[11px] text-violet-800"
              >
                律师已申请完成任务，请审阅下方全部交付记录并确认或提出争议。
              </div>
              <div
                v-else-if="task.status === 'in_progress' && !submissions.length"
                class="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-800"
              >
                任务进行中，律师尚未提交过程材料。
              </div>
              <div
                v-else-if="task.status === 'disputed'"
                class="p-3 bg-orange-50 border border-orange-100 rounded-lg text-[11px] text-orange-800"
              >
                任务处于争议状态，可退回进行中让律师继续补充，或直接确认完成。
              </div>

              <section>
                <div class="flex items-center gap-2 mb-3">
                  <FileText class="w-4 h-4 text-slate-500" />
                  <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    交付时间线 ({{ timelineSubmissions.length }})
                  </h4>
                </div>

                <div v-if="!timelineSubmissions.length" class="py-10 flex flex-col items-center text-slate-400">
                  <Inbox class="w-10 h-10 mb-2 opacity-40" />
                  <p class="text-xs">暂无交付记录</p>
                </div>

                <div v-else class="space-y-3">
                  <article
                    v-for="sub in timelineSubmissions"
                    :key="sub.id"
                    class="border rounded-xl p-4"
                    :class="
                      sub.submissionType === 'completion'
                        ? 'border-violet-200 bg-violet-50/50'
                        : 'border-slate-100 bg-white'
                    "
                  >
                    <div class="flex items-start gap-2">
                      <span
                        v-if="sub.submissionType === 'progress'"
                        class="shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center"
                      >
                        {{ progressStageIndex(sub) }}
                      </span>
                      <CheckCircle2
                        v-else
                        class="w-5 h-5 text-violet-600 shrink-0 mt-0.5"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <h5 class="text-sm font-bold text-slate-800">{{ sub.title }}</h5>
                          <span
                            class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            :class="
                              sub.submissionType === 'completion'
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-slate-100 text-slate-600'
                            "
                          >
                            {{ TASK_SUBMISSION_TYPE_LABELS[sub.submissionType] }}
                          </span>
                          <span class="text-[10px] text-slate-400 font-mono ml-auto shrink-0">
                            {{ formatDate(sub.createdAt) }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed break-words">
                          {{ sub.content }}
                        </p>
                        <ul v-if="sub.attachmentUrls.length" class="mt-3 space-y-1.5">
                          <li
                            v-for="path in sub.attachmentUrls"
                            :key="path"
                            class="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100"
                          >
                            <span class="flex items-center gap-1 min-w-0">
                              <Paperclip class="w-3 h-3 shrink-0" />
                              <span class="truncate" :title="attachmentName(path)">{{ attachmentName(path) }}</span>
                            </span>
                            <a
                              v-if="attachmentLinks[path]"
                              :href="attachmentLinks[path]"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-[#fa8231] font-semibold shrink-0 inline-flex items-center gap-0.5 hover:underline"
                            >
                              查看
                              <ExternalLink class="w-3 h-3" />
                            </a>
                            <span v-else class="text-slate-400 text-[10px] shrink-0">加载中…</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </template>
          </div>

          <div class="border-t border-slate-100 px-6 py-3 shrink-0 flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg"
              @click="emit('close')"
            >
              关闭
            </button>
            <button
              v-if="task.status === 'disputed'"
              type="button"
              :disabled="acting"
              class="px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              @click="handleReopen"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              退回进行中
            </button>
            <template v-if="task.status === 'awaiting_completion'">
              <button
                type="button"
                :disabled="acting"
                class="px-4 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                @click="handleDispute"
              >
                <AlertTriangle class="w-3.5 h-3.5" />
                提出争议
              </button>
              <button
                type="button"
                :disabled="acting"
                class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                @click="handleConfirm"
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
                确认完成
              </button>
            </template>
            <button
              v-if="task.status === 'disputed'"
              type="button"
              :disabled="acting"
              class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              @click="handleConfirm"
            >
              <CheckCircle2 class="w-3.5 h-3.5" />
              确认完成
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
