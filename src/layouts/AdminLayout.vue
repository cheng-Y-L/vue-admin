<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { LogOut, Menu, X, Lock, Clock } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { NAV_ITEMS } from '@/router/nav'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()
const { currentUser } = storeToRefs(auth)
const { isSidebarOpen, currentTime } = storeToRefs(app)

onMounted(() => app.startClock())
onUnmounted(() => app.stopClock())

async function handleSignOut() {
  await auth.logout()
  router.push('/login')
}

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-800 flex overflow-hidden">
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 bg-slate-950 text-slate-400 w-64 transform transition-transform duration-350 ease-out flex flex-col justify-between border-r border-slate-900',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-0 -ml-64 lg:ml-0 lg:translate-x-0',
      ]"
    >
      <div>
        <div class="p-5 border-b border-slate-900 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 bg-[#fa8231] text-white rounded-lg flex items-center justify-center font-bold text-base shadow-sm">
              A
            </div>
            <div>
              <span class="font-space font-bold text-sm text-slate-100 block tracking-tight">Admin Console</span>
              <span class="text-[10px] text-slate-500 font-mono block">v4.0 PRO / Vue</span>
            </div>
          </div>
          <button
            class="lg:hidden p-1.5 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-white transition"
            @click="isSidebarOpen = false"
          >
            <X class="w-4.5 h-4.5" />
          </button>
        </div>

        <div v-if="currentUser" class="p-4 mx-3 my-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-center gap-3">
          <div class="relative">
            <img
              :src="currentUser.avatar"
              alt="avatar"
              class="w-10 h-10 rounded-full object-cover border border-slate-800"
              referrerpolicy="no-referrer"
            />
            <span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
          </div>
          <div class="min-w-0 flex-1">
            <span class="text-xs font-bold text-slate-200 block truncate">{{ currentUser.nickname }}</span>
            <span class="text-[10px] bg-slate-900 text-[#fa8231] px-1.5 py-0.5 rounded-sm font-semibold inline-block capitalize mt-0.5 font-mono">
              {{ currentUser.role }}
            </span>
          </div>
        </div>

        <nav class="px-3 space-y-1">
          <RouterLink
            v-for="item in NAV_ITEMS"
            :key="item.path"
            :to="item.path"
            class="w-full text-xs font-semibold py-3 px-3 rounded-xl transition-all flex items-center justify-between group"
            :class="
              isActive(item.path)
                ? 'bg-[#fa8231] text-white shadow-md shadow-[#fa8231]/15 font-bold scale-[1.01]'
                : 'hover:bg-slate-900 hover:text-slate-100 text-slate-400'
            "
            @click="app.closeSidebarOnMobile()"
          >
            <div class="flex items-center gap-2.5">
              <component
                :is="item.icon"
                class="w-4.5 h-4.5 transition-colors"
                :class="isActive(item.path) ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'"
              />
              <span>{{ item.label }}</span>
            </div>
            <Lock
              v-if="currentUser && !auth.hasPermission(item.permission)"
              class="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-500 transition-colors"
              title="无查看或写权限/锁定项"
            />
          </RouterLink>
        </nav>
      </div>

      <div class="p-4 border-t border-slate-900">
        <div class="p-3 bg-slate-900/40 rounded-xl mb-4 text-[10px] text-slate-500 font-mono text-center">
          IP: 204.88.92.11 (CN)
        </div>
        <button
          class="w-full py-2.5 bg-slate-900 hover:bg-red-950/30 text-rose-500 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-900 hover:border-rose-900/30 group cursor-pointer"
          @click="handleSignOut"
        >
          <LogOut class="w-4.5 h-4.5 text-rose-500 group-hover:-translate-x-1 transition-transform" />
          登出协同控制台
        </button>
      </div>
    </aside>

    <div class="flex-1 lg:pl-64 flex flex-col min-h-screen">
      <header class="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xs backdrop-blur-md bg-white/95">
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
            @click="app.toggleSidebar()"
          >
            <Menu class="w-5 h-5" />
          </button>
          <div class="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl font-medium">
            <Clock class="w-4 h-4 text-slate-400" />
            <span>系统标准时间: {{ currentTime || '加载中...' }}</span>
          </div>
          <div class="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[10px] px-2.5 py-1 rounded-full border border-emerald-100 font-semibold uppercase tracking-wider scale-95">
            <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
            数字主仓在线
          </div>
        </div>
        <div v-if="currentUser" class="flex items-center gap-3">
          <div class="text-right hidden md:block">
            <span class="text-xs font-bold text-slate-900 block">{{ currentUser.nickname }}</span>
            <span class="text-[10.5px] text-slate-500 block">配属机构: 系统运营总站</span>
          </div>
          <img
            :src="currentUser.avatar"
            alt="avatar"
            class="w-8.5 h-8.5 rounded-full object-cover border border-slate-100 shadow-sm"
            referrerpolicy="no-referrer"
          />
        </div>
      </header>

      <main class="flex-1 p-6 max-w-7xl mx-auto w-full overflow-y-auto">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>

      <footer class="bg-white border-t border-slate-100 py-3.5 text-center text-[10.5px] text-slate-400 font-medium">
        <span>© 2026 智能大脑数字管理中枢. 全业务流水及安全痕迹由密态区块链沙箱全程核审计保护.</span>
      </footer>
    </div>
  </div>
</template>
