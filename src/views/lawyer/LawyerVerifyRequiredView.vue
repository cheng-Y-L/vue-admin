<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldAlert, FileText, LogOut, Clock, XCircle } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { LAWYER_CERT_STATUS_LABELS } from '@/constants/lawyer-cert'
import { isLawyerProfileComplete } from '@/utils/lawyer-cert'

const router = useRouter()
const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)

const status = computed(() => currentUser.value?.certificationStatus ?? 'none')

const headline = computed(() => {
  if (status.value === 'pending') return '资质认证审核中'
  if (status.value === 'rejected') return '资质认证未通过'
  return '需要完成律师资质认证'
})

const description = computed(() => {
  if (status.value === 'pending') {
    return '您已提交个人资料与执业信息，平台正在审核。审核通过前暂无法使用系统功能，请耐心等待。'
  }
  if (status.value === 'rejected') {
    return '您的资质认证申请已被驳回。请核对资料后重新填写并提交，或联系平台管理员了解原因。'
  }
  if (currentUser.value && isLawyerProfileComplete(currentUser.value)) {
    return '资料已保存但尚未通过认证。请确认信息无误后提交认证申请，或等待管理员审核。'
  }
  return '根据平台规定，律师账号须先完善个人执业资料并完成资质认证后，方可访问驾驶舱与业务模块。'
})

async function goProfile() {
  await router.push({ name: 'lawyer-profile' })
}

async function handleLogout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-lg bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
      <div class="p-8 text-center bg-gradient-to-br from-amber-50 to-orange-50 border-b border-orange-100">
        <div
          class="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 border"
          :class="
            status === 'pending'
              ? 'bg-blue-50 text-blue-600 border-blue-100'
              : status === 'rejected'
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-amber-50 text-[#fa8231] border-orange-100'
          "
        >
          <Clock v-if="status === 'pending'" class="w-7 h-7" />
          <XCircle v-else-if="status === 'rejected'" class="w-7 h-7" />
          <ShieldAlert v-else class="w-7 h-7" />
        </div>
        <h1 class="font-space font-bold text-lg text-slate-900">{{ headline }}</h1>
        <p class="text-xs text-slate-500 mt-2 leading-relaxed px-2">{{ description }}</p>
        <span
          class="inline-block mt-3 text-[10px] font-semibold px-2.5 py-1 rounded-full border"
          :class="
            status === 'approved'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : status === 'pending'
                ? 'bg-blue-50 text-blue-700 border-blue-100'
                : status === 'rejected'
                  ? 'bg-red-50 text-red-700 border-red-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
          "
        >
          当前状态：{{ LAWYER_CERT_STATUS_LABELS[status] }}
        </span>
      </div>

      <div class="p-6 space-y-4">
        <div class="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left text-[11px] text-slate-600 space-y-2">
          <span class="font-bold text-slate-900 block text-xs">您需要完成以下步骤</span>
          <p class="flex items-start gap-2">
            <span class="shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">1</span>
            填写真实姓名、身份证号、执业机构、律师执业证号，并上传律师证照片
          </p>
          <p class="flex items-start gap-2">
            <span class="shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">2</span>
            提交资质认证申请，等待平台审核通过
          </p>
        </div>

        <button
          v-if="status !== 'pending'"
          type="button"
          class="w-full py-3 bg-[#fa8231] hover:bg-[#e67428] text-white text-sm font-semibold rounded-xl transition shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          @click="goProfile"
        >
          <FileText class="w-4 h-4" />
          {{ status === 'rejected' ? '修改资料并重新提交' : '前往填写个人资料与认证' }}
        </button>

        <button
          type="button"
          class="w-full py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          @click="handleLogout"
        >
          <LogOut class="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  </div>
</template>
