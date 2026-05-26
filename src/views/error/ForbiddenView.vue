<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ShieldAlert } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)

const permission = (route.query.permission as string) || '未知模块'

function goDashboard() {
  if (auth.hasPermission('dashboard_view')) {
    router.push({
      name: 'dashboard',
    })
  }
}
</script>

<template>
  <div v-if="currentUser" class="bg-white border border-slate-150 rounded-2xl p-12 text-center shadow-xs flex flex-col items-center justify-center max-w-lg mx-auto my-12">
    <div class="w-16 h-16 bg-amber-50 text-[#fa8231] rounded-2xl flex items-center justify-center mb-4 border border-orange-100">
      <ShieldAlert class="w-8 h-8" />
    </div>
    <h3 class="font-space font-bold text-base text-slate-900">🔒 访问已被安全阻断 (Access Reserved)</h3>
    <p class="text-xs text-slate-500 mt-2 leading-relaxed">
      很抱歉，您当前的系统配属角色为 <b>{{ currentUser.nickname }} ({{ currentUser.role }})</b>，暂未取得该选项板所需的
      <b>「{{ permission }}」</b> 审核授权。
    </p>
    <div class="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl text-left text-[11px] text-slate-600 space-y-1 w-full font-medium">
      <span class="font-bold text-slate-900 block mb-1">如何开通相应模块？</span>
      <p>1. 请超级管理员在<b>「协同权限配置」</b>模块找到您的账号 <b>@{{ currentUser.username }}</b>。</p>
      <p>2. 直接勾选并为您指派所需的模块权限卡即可立即生效，无需重新登录。</p>
    </div>
    <button
      v-if="auth.hasPermission('dashboard_view')"
      class="mt-6 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-md active:scale-95 cursor-pointer"
      @click="goDashboard"
    >
      返回驾驶首仓页
    </button>
  </div>
</template>
