<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  FileText,
  Upload,
  Paperclip,
  Loader2,
  Send,
  CheckCircle2,
  Clock,
  ExternalLink,
} from '@lucide/vue'
import { TASK_SUBMISSION_TYPE_LABELS, TASK_STATUS_LABELS } from '@/constants/tasks'
import { isSupabaseConfigured } from '@/lib/supabase'
import { uploadTaskAttachment, getTaskAttachmentSignedUrl } from '@/services/task.service'
import {
  fetchTaskSubmissions,
  submitTaskProgress,
  type SubmitTaskPayload,
} from '@/services/task-submission.service'
import type { Task, TaskSubmission, User } from '@/types'

const props = defineProps<{
  task: Task
  currentUser: User
}>()

const emit = defineEmits<{
  updated: []
}>()

const submissions = ref<TaskSubmission[]>([])
const loading = ref(true)
const submitting = ref(false)
const uploading = ref(false)
const showForm = ref(false)
const formMode = ref<'progress' | 'completion'>('progress')

const title = ref('')
const content = ref('')
const pendingFiles = ref<File[]>([])
const attachmentUrls = ref<string[]>([])
const attachmentLinks = ref<Record<string, string>>({})

const isAssignedLawyer = computed(
  () => props.task.assignedLawyerId === props.currentUser.id,
)
const canSubmitProgress = computed(
  () => isAssignedLawyer.value && props.task.status === 'in_progress',
)
const isAwaitingConfirmation = computed(
  () => isAssignedLawyer.value && props.task.status === 'awaiting_completion',
)
const isDisputed = computed(() => isAssignedLawyer.value && props.task.status === 'disputed')

onMounted(() => loadSubmissions())
watch(() => props.task.id, () => loadSubmissions())
watch(() => props.task.status, () => loadSubmissions())

async function loadSubmissions() {
  loading.value = true
  submissions.value = await fetchTaskSubmissions(props.task.id)
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

function openForm(mode: 'progress' | 'completion') {
  formMode.value = mode
  title.value = mode === 'completion' ? '任务完成报告' : ''
  content.value = ''
  attachmentUrls.value = []
  pendingFiles.value = []
  showForm.value = true
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

function attachmentName(path: string) {
  return path.split('/').pop() ?? path
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

async function handleSubmit() {
  const uploadError = await uploadPendingFiles()
  if (uploadError) {
    alert(uploadError)
    return
  }

  const payload: SubmitTaskPayload = {
    title: title.value,
    content: content.value,
    attachmentUrls: attachmentUrls.value,
    submissionType: formMode.value,
  }

  if (formMode.value === 'completion') {
    if (!confirm('确定申请完成任务？提交后任务将进入「待确认完成」，等待发布方审核。')) return
  }

  submitting.value = true
  const { submission, error } = await submitTaskProgress(props.task.id, props.currentUser.id, payload)
  submitting.value = false

  if (error || !submission) {
    alert(error ?? '提交失败')
    return
  }

  showForm.value = false
  await loadSubmissions()
  emit('updated')
}
</script>

<template>
  <div v-if="isAssignedLawyer" class="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
        <FileText class="w-4 h-4" />
        任务过程与交付
      </h3>
      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-50 text-slate-600">
        {{ TASK_STATUS_LABELS[task.status] }}
      </span>
    </div>

    <div
      v-if="isAwaitingConfirmation"
      class="p-3 bg-violet-50 border border-violet-100 rounded-lg text-[11px] text-violet-800 flex items-start gap-2"
    >
      <Clock class="w-4 h-4 shrink-0 mt-0.5" />
      <p>您已申请完成任务，正在等待发布方确认。确认前不可提交新材料。</p>
    </div>

    <div
      v-else-if="isDisputed"
      class="p-3 bg-orange-50 border border-orange-100 rounded-lg text-[11px] text-orange-800"
    >
      发布方对交付成果提出争议，请等待发布方处理或联系沟通后重新提交材料。
    </div>

    <div v-if="canSubmitProgress" class="flex flex-wrap gap-2">
      <button
        class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
        @click="openForm('progress')"
      >
        <Send class="w-3.5 h-3.5" />
        提交阶段报告
      </button>
      <button
        class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
        @click="openForm('completion')"
      >
        <CheckCircle2 class="w-3.5 h-3.5" />
        申请完成任务
      </button>
    </div>

    <form v-if="showForm" class="space-y-3 p-4 bg-slate-50 border border-slate-100 rounded-xl" @submit.prevent="handleSubmit">
      <p class="text-[11px] font-semibold text-slate-600">
        {{ formMode === 'completion' ? '完成报告（提交后进入待确认）' : '阶段报告' }}
      </p>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">标题 *</label>
        <input
          v-model="title"
          type="text"
          :placeholder="formMode === 'completion' ? '如：最终法律意见书' : '如：第一次庭审情况汇报'"
          class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
        />
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">报告内容 *</label>
        <textarea
          v-model="content"
          rows="5"
          placeholder="详细描述本阶段工作进展、成果或完成情况..."
          class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 resize-none"
        />
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">附件</label>
        <label class="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-slate-400 bg-white transition">
          <Upload class="w-4 h-4 text-slate-400" />
          <span class="text-[11px] text-slate-500">PDF / Word / 图片</span>
          <input type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" class="hidden" @change="handleFileSelect" />
        </label>
        <ul v-if="pendingFiles.length" class="mt-2 space-y-1">
          <li
            v-for="(file, i) in pendingFiles"
            :key="i"
            class="flex items-center justify-between text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded"
          >
            <span class="truncate">{{ file.name }}</span>
            <button type="button" class="text-red-500 ml-2 shrink-0" @click="removePendingFile(i)">移除</button>
          </li>
        </ul>
      </div>
      <div class="flex gap-2 justify-end">
        <button
          type="button"
          class="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg"
          @click="showForm = false"
        >
          取消
        </button>
        <button
          type="submit"
          :disabled="submitting || uploading"
          class="px-3 py-1.5 bg-[#fa8231] text-white text-xs font-bold rounded-lg flex items-center gap-1 disabled:opacity-50 cursor-pointer"
        >
          <Loader2 v-if="submitting || uploading" class="w-3.5 h-3.5 animate-spin" />
          提交
        </button>
      </div>
    </form>

    <div v-if="loading" class="py-8 text-center text-slate-400 text-xs">加载提交记录...</div>

    <div v-else-if="!submissions.length" class="py-8 text-center text-slate-400 text-xs">
      暂无过程提交记录
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="sub in submissions"
        :key="sub.id"
        class="border border-slate-100 rounded-xl p-4"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-sm font-bold text-slate-800">{{ sub.title }}</h4>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                {{ TASK_SUBMISSION_TYPE_LABELS[sub.submissionType] }}
              </span>
            </div>
            <p class="text-[10px] text-slate-400 font-mono mt-1">{{ formatDate(sub.createdAt) }}</p>
          </div>
        </div>
        <p class="text-xs text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">{{ sub.content }}</p>
        <ul v-if="sub.attachmentUrls.length" class="mt-3 space-y-1">
          <li
            v-for="path in sub.attachmentUrls"
            :key="path"
            class="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded"
          >
            <span class="flex items-center gap-1 truncate">
              <Paperclip class="w-3 h-3 shrink-0" />
              {{ attachmentName(path) }}
            </span>
            <a
              v-if="attachmentLinks[path]"
              :href="attachmentLinks[path]"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[#fa8231] font-semibold shrink-0 ml-2 inline-flex items-center gap-0.5"
            >
              查看
              <ExternalLink class="w-3 h-3" />
            </a>
            <span v-else-if="!isSupabaseConfigured() && path.startsWith('local://')" class="text-slate-400 text-[10px]">
              本地演示
            </span>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>
