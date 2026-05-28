<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Loader2, ShieldCheck, Upload, ImageIcon, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import {
  submitLawyerCertification,
  uploadLawyerLicenseImage,
  getLawyerLicenseSignedUrl,
  validateLawyerLicenseFile,
} from '@/services/lawyer-cert.service'
import { LAWYER_LICENSE_ACCEPT } from '@/constants/lawyer-cert'

const router = useRouter()
const auth = useAuthStore()
const { currentUser, authLoading } = storeToRefs(auth)

const realName = ref('')
const idCard = ref('')
const lawFirm = ref('')
const licenseNumber = ref('')
const practiceArea = ref('')
const licenseImagePath = ref('')
const licensePreviewUrl = ref('')
const licenseFile = ref<File | null>(null)
const uploading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

let objectPreviewUrl: string | null = null

function revokeObjectPreview() {
  if (objectPreviewUrl) {
    URL.revokeObjectURL(objectPreviewUrl)
    objectPreviewUrl = null
  }
}

async function loadExistingPreview(path: string) {
  revokeObjectPreview()
  const signed = await getLawyerLicenseSignedUrl(path)
  licensePreviewUrl.value = signed ?? ''
}

onMounted(async () => {
  const u = currentUser.value
  if (!u) return
  realName.value = u.realName ?? ''
  idCard.value = u.idCard ?? ''
  lawFirm.value = u.lawFirm ?? ''
  licenseNumber.value = u.licenseNumber ?? ''
  practiceArea.value = u.practiceArea ?? ''
  if (u.licenseImageUrl) {
    licenseImagePath.value = u.licenseImageUrl
    await loadExistingPreview(u.licenseImageUrl)
  }
})

onUnmounted(() => {
  revokeObjectPreview()
})

function onLicenseFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const validationError = validateLawyerLicenseFile(file)
  if (validationError) {
    errorMsg.value = validationError
    input.value = ''
    return
  }

  errorMsg.value = ''
  licenseFile.value = file
  revokeObjectPreview()
  objectPreviewUrl = URL.createObjectURL(file)
  licensePreviewUrl.value = objectPreviewUrl
}

function clearLicenseSelection() {
  licenseFile.value = null
  licensePreviewUrl.value = ''
  revokeObjectPreview()
  if (currentUser.value?.licenseImageUrl) {
    licenseImagePath.value = currentUser.value.licenseImageUrl
    void loadExistingPreview(currentUser.value.licenseImageUrl)
  } else {
    licenseImagePath.value = ''
  }
}

async function handleSubmit(e: Event) {
  e.preventDefault()
  errorMsg.value = ''
  successMsg.value = ''

  if (!currentUser.value) return

  let imagePath = licenseImagePath.value.trim()

  if (licenseFile.value) {
    uploading.value = true
    const { path, error } = await uploadLawyerLicenseImage(currentUser.value.id, licenseFile.value)
    uploading.value = false
    if (error || !path) {
      errorMsg.value = error ?? '律师证图片上传失败'
      return
    }
    imagePath = path
    licenseImagePath.value = path
    licenseFile.value = null
  }

  if (!imagePath) {
    errorMsg.value = '请上传律师执业证照片'
    return
  }

  const { user, error } = await submitLawyerCertification(currentUser.value.id, {
    realName: realName.value,
    idCard: idCard.value,
    lawFirm: lawFirm.value,
    licenseNumber: licenseNumber.value,
    practiceArea: practiceArea.value,
    licenseImageUrl: imagePath,
  })

  if (error || !user) {
    errorMsg.value = error ?? '提交失败'
    return
  }

  auth.setUser(user)
  successMsg.value = '资料已提交，请等待平台审核'
  setTimeout(() => {
    router.replace({ name: 'lawyer-verify-required' })
  }, 1200)
}

function goBack() {
  router.push({ name: 'lawyer-verify-required' })
}

const isBusy = computed(() => authLoading.value || uploading.value)
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-8 px-4">
    <div class="max-w-xl mx-auto">
      <button
        type="button"
        class="mb-4 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
        @click="goBack"
      >
        <ArrowLeft class="w-4 h-4" /> 返回认证说明
      </button>

      <div class="bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden">
        <div class="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
              <ShieldCheck class="w-5 h-5" />
            </div>
            <div>
              <h1 class="font-space font-bold text-base text-slate-900">律师个人资料与资质认证</h1>
              <p class="text-[11px] text-slate-500 mt-0.5">请如实填写执业信息并上传律师证照片，提交后进入平台审核流程</p>
            </div>
          </div>
        </div>

        <div v-if="errorMsg" class="mx-6 mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl">
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl">
          {{ successMsg }}
        </div>

        <form class="p-6 space-y-4" @submit="handleSubmit">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">真实姓名 *</label>
            <input
              v-model="realName"
              type="text"
              required
              placeholder="与身份证一致"
              class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">身份证号码 *</label>
            <input
              v-model="idCard"
              type="text"
              required
              maxlength="18"
              placeholder="18 位身份证号"
              class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">执业机构 *</label>
            <input
              v-model="lawFirm"
              type="text"
              required
              placeholder="律师事务所全称"
              class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">律师执业证号 *</label>
            <input
              v-model="licenseNumber"
              type="text"
              required
              placeholder="执业证编号"
              class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">律师执业证照片 *</label>
            <p class="text-[10px] text-slate-400 mb-2">请上传执业证首页清晰照片，支持 JPG / PNG / WebP，不超过 5MB</p>

            <div
              v-if="licensePreviewUrl"
              class="relative mb-3 rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
            >
              <img
                :src="licensePreviewUrl"
                alt="律师执业证预览"
                class="w-full max-h-56 object-contain"
              />
              <button
                type="button"
                class="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900 cursor-pointer"
                title="重新选择"
                @click="clearLicenseSelection"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <label
              class="flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:border-slate-400 hover:bg-white transition cursor-pointer"
            >
              <ImageIcon v-if="licensePreviewUrl" class="w-6 h-6 text-slate-400" />
              <Upload v-else class="w-6 h-6 text-slate-400" />
              <span class="text-xs text-slate-600 font-medium">
                {{ licensePreviewUrl ? '点击更换律师证照片' : '点击上传律师证照片' }}
              </span>
              <input
                type="file"
                class="hidden"
                :accept="LAWYER_LICENSE_ACCEPT"
                @change="onLicenseFileChange"
              />
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">主要执业领域</label>
            <input
              v-model="practiceArea"
              type="text"
              placeholder="如：民商事诉讼、知识产权（选填）"
              class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            :disabled="isBusy"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Loader2 v-if="isBusy" class="w-4 h-4 animate-spin" />
            <template v-else>提交资质认证申请</template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
