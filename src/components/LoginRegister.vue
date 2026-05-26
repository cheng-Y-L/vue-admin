<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Shield,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  UserPlus,
  LogIn,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { resetPassword } from '@/services/auth.service'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { authLoading } = storeToRefs(auth)

const tab = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const username = ref('')
const nickname = ref('')
const role = ref<'admin' | 'editor' | 'viewer'>('viewer')
const avatar = ref('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')
const errorMsg = ref('')
const successMsg = ref('')
const showForgot = ref(false)

const AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
]

function clearMessages() {
  errorMsg.value = ''
  successMsg.value = ''
}

async function navigateAfterAuth() {
  const redirect = (route.query.redirect as string) || auth.getDefaultPath()
  await router.replace(redirect)
}

async function handleLogin(e: Event) {
  e.preventDefault()
  clearMessages()

  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  const result = await auth.loginWithCredentials(username.value, password.value)
  if (!result.ok) {
    errorMsg.value = result.error
    return
  }
  successMsg.value = '登录成功！正在加载系统...'
  setTimeout(navigateAfterAuth, 1000)
}

async function handleRegister(e: Event) {
  e.preventDefault()
  clearMessages()

  if (!username.value.trim() || !nickname.value.trim() || !email.value.trim()) {
    errorMsg.value = '请填写所有必填信息'
    return
  }
  if (username.value.length < 3) {
    errorMsg.value = '用户名长度至少为 3 个字符'
    return
  }

  if (password.value.length < 6) {
    errorMsg.value = '密码至少需要 6 位'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }

  const result = await auth.register({
    email: email.value.trim(),
    password: password.value,
    username: username.value.trim(),
    nickname: nickname.value.trim(),
    role: role.value,
    avatar: avatar.value,
  })

  if (!result.ok) {
    errorMsg.value = result.error
    return
  }
  if (result.needsEmailConfirmation) {
    successMsg.value = '注册成功！请查收邮箱验证链接，验证后即可登录。'
    tab.value = 'login'
    return
  }
  successMsg.value = '注册成功！正在为您自动登录...'
  setTimeout(navigateAfterAuth, 1200)
}

async function handleForgotPassword(e: Event) {
  e.preventDefault()
  clearMessages()

  if (!email.value.trim()) {
    errorMsg.value = '请输入注册邮箱'
    return
  }

  const { error } = await resetPassword(email.value)
  if (error) {
    errorMsg.value = error
    return
  }
  successMsg.value = '重置邮件已发送，请查收邮箱并按指引操作'
  showForgot.value = false
}
</script>

<template>
  <div class="min-h-screen w-full bg-[#fa8231]/5 bg-radial-gradient flex items-center justify-center p-4 selection:bg-[#fa8231]/30">
    <div class="absolute top-1/4 left-1/4 w-72 h-72 bg-[#fa8231]/10 rounded-full blur-3xl -z-10 animate-pulse" />
    <div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -z-10 animate-pulse delay-700" />

    <div class="w-full max-w-md bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="p-8 text-center bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-100 flex flex-col items-center">
        <div class="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-slate-900/10 hover:rotate-12 transition-transform duration-300">
          <Shield class="w-6 h-6 text-slate-100" />
        </div>
        <h1 class="font-space font-bold text-xl text-slate-900 tracking-tight">智能后台管理原型系统</h1>
        <p class="text-slate-500 text-xs mt-1">智慧大脑多维度全息数据驾驶舱 · Vue 3</p>
        <div class="mt-4 p-2 bg-slate-200/50 rounded-lg text-[11px] text-slate-600 border border-slate-200">
          使用注册时的<strong class="text-slate-900">用户名</strong>与密码登录；也可输入注册邮箱登录。
        </div>
      </div>

      <div class="flex border-b border-slate-100 p-2 bg-slate-200/20">
        <button
          class="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          :class="tab === 'login' ? 'bg-white text-slate-900 shadow-xs border border-slate-100 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/30'"
          @click="tab = 'login'; showForgot = false; clearMessages()"
        >
          <LogIn class="w-4 h-4" /> 用户登录
        </button>
        <button
          class="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          :class="tab === 'register' ? 'bg-white text-slate-900 shadow-xs border border-slate-100 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/30'"
          @click="tab = 'register'; showForgot = false; clearMessages()"
        >
          <UserPlus class="w-4 h-4" /> 账号注册
        </button>
      </div>

      <div v-if="errorMsg" class="mx-6 mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 shrink-0 text-red-600" />
        <span>{{ errorMsg }}</span>
      </div>
      <div v-if="successMsg" class="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
        <CheckCircle class="w-4 h-4 shrink-0 text-emerald-600" />
        <span>{{ successMsg }}</span>
      </div>

      <div class="p-6">
        <!-- 找回密码（内嵌，不改变整体布局） -->
        <form v-if="tab === 'login' && showForgot" class="space-y-4" @submit="handleForgotPassword">
          <p class="text-xs text-slate-500">输入注册邮箱，我们将发送密码重置链接。</p>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">邮箱地址</label>
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="email"
                type="email"
                placeholder="your@system.com"
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            :disabled="authLoading"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Loader2 v-if="authLoading" class="w-4 h-4 animate-spin" />
            <template v-else>发送重置邮件 <ArrowRight class="w-4 h-4" /></template>
          </button>
          <button type="button" class="w-full text-xs text-slate-500 hover:text-slate-800" @click="showForgot = false; clearMessages()">
            返回登录
          </button>
        </form>

        <form v-else-if="tab === 'login'" class="space-y-4" @submit="handleLogin">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">用户名或邮箱</label>
            <div class="relative">
              <UserIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="username"
                type="text"
                autocomplete="username"
                placeholder="注册时的用户名，或邮箱"
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">登录密码 (Password)</label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="password"
                type="password"
                placeholder="请输入密码"
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
            <button
              type="button"
              class="mt-1.5 text-[11px] text-slate-500 hover:text-slate-800"
              @click="showForgot = true; clearMessages()"
            >
              忘记密码？
            </button>
          </div>
          <button
            type="submit"
            :disabled="authLoading"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Loader2 v-if="authLoading" class="w-4 h-4 animate-spin" />
            <template v-else>授权开通登录 <ArrowRight class="w-4 h-4" /></template>
          </button>
        </form>

        <form v-else class="space-y-4" @submit="handleRegister">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">系统用户名 *</label>
            <div class="relative">
              <UserIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="username"
                type="text"
                placeholder="英文/拼音缩写"
                required
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">系统用户昵称 *</label>
            <div class="relative">
              <Sparkles class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="nickname"
                type="text"
                placeholder="显示中文昵称"
                required
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">邮箱地址 *</label>
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="email"
                type="email"
                placeholder="your@system.com"
                required
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">登录密码 *</label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="password"
                type="password"
                placeholder="至少 6 位"
                required
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">确认密码 *</label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                required
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">权限角色选择</label>
            <select
              v-model="role"
              class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all"
            >
              <option value="admin">超级管理员 (全部页面与数据操作权限)</option>
              <option value="editor">运营编辑 (可读写订单，查看数据)</option>
              <option value="viewer">数据分析员 (仅查看数据与驾驶舱)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">头像快速选择</label>
            <div class="grid grid-cols-6 gap-2">
              <button
                v-for="(url, index) in AVATARS"
                :key="index"
                type="button"
                class="relative rounded-lg overflow-hidden border-2 w-10 h-10 transition-all"
                :class="avatar === url ? 'border-slate-900 scale-105 shadow-sm' : 'border-transparent hover:scale-105'"
                @click="avatar = url"
              >
                <img :src="url" alt="avatar" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            :disabled="authLoading"
            class="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Loader2 v-if="authLoading" class="w-4 h-4 animate-spin" />
            <template v-else>新建档案并登录 <ArrowRight class="w-4 h-4" /></template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
