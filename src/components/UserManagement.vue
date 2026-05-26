<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Users, UserPlus, ShieldAlert, Key, Search, ToggleLeft, ToggleRight, Trash2, X } from '@lucide/vue'
import { db } from '@/services/data'
import { isSupabaseConfigured } from '@/lib/supabase'
import { fetchAllProfiles, updateProfile, deleteProfile } from '@/services/profile.service'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'

const props = defineProps<{ currentUser: User }>()
const auth = useAuthStore()

function syncCurrentUserIfNeeded(userId: string) {
  if (userId === props.currentUser.id) auth.refreshFromDb()
}

const users = ref<User[]>([])
const searchQuery = ref('')
const roleFilter = ref<'all' | User['role']>('all')
const showAddModal = ref(false)
const newUsername = ref('')
const newNickname = ref('')
const newEmail = ref('')
const newRole = ref<User['role']>('viewer')

const ALL_POSSIBLE_PERMISSIONS = [
  { id: 'dashboard_view', label: '开通：驾驶舱首页查看' },
  { id: 'data_stats_view', label: '开通：多维统计图分析' },
  { id: 'order_manage', label: '开通：订单模块写操作' },
  { id: 'user_manage', label: '开通：用户权限与停启' },
  { id: 'system_logs_view', label: '开通：操作日志审计' },
]

async function loadUsers() {
  if (isSupabaseConfigured()) {
    users.value = await fetchAllProfiles()
  } else {
    users.value = db.getUsers()
  }
}

onMounted(() => {
  loadUsers()
})

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return users.value.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(query) ||
      u.nickname.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    if (roleFilter.value === 'all') return matchesSearch
    return matchesSearch && u.role === roleFilter.value
  })
})

async function handleToggleStatus(userId: string) {
  if (props.currentUser.role !== 'admin') {
    alert('🔒 权限受限：只有超级管理员可以更改用户挂起状态')
    return
  }
  if (userId === props.currentUser.id) {
    alert('❌ 无法执行：您无法将自己停用')
    return
  }
  const target = users.value.find((u) => u.id === userId)
  if (!target) return
  const nextStatus = target.status === 'active' ? 'suspended' : 'active'
  db.addLog(props.currentUser.username, '管理员', `更改用户状态: ${target.username} -> ${nextStatus === 'active' ? '激活' : '暂停'}`, 'UserManage', 'success')

  if (isSupabaseConfigured()) {
    const { ok, error } = await updateProfile(userId, { status: nextStatus })
    if (!ok) {
      alert(error ?? '更新失败')
      return
    }
    await loadUsers()
  } else {
    const updated = users.value.map((u) => (u.id === userId ? { ...u, status: nextStatus as User['status'] } : u))
    db.saveUsers(updated)
    users.value = updated
  }
  syncCurrentUserIfNeeded(userId)
}

async function handleRoleChange(userId: string, requestedRole: User['role']) {
  if (props.currentUser.role !== 'admin' || userId === props.currentUser.id) return
  let recommendedPerms = ['dashboard_view', 'data_stats_view']
  if (requestedRole === 'admin') recommendedPerms = ['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view']
  else if (requestedRole === 'editor') recommendedPerms = ['dashboard_view', 'order_manage', 'data_stats_view']

  const target = users.value.find((u) => u.id === userId)
  if (!target) return
  db.addLog(props.currentUser.username, '管理员', `变更用户角色: ${target.username}`, 'Permissions', 'success')

  if (isSupabaseConfigured()) {
    const { ok, error } = await updateProfile(userId, { role: requestedRole, permissions: recommendedPerms })
    if (!ok) {
      alert(error ?? '更新失败')
      return
    }
    await loadUsers()
  } else {
    const updated = users.value.map((u) =>
      u.id === userId ? { ...u, role: requestedRole, permissions: recommendedPerms } : u,
    )
    db.saveUsers(updated)
    users.value = updated
  }
  syncCurrentUserIfNeeded(userId)
}

async function handleTogglePermission(userId: string, permissionId: string) {
  if (props.currentUser.role !== 'admin' || userId === props.currentUser.id) return
  const target = users.value.find((u) => u.id === userId)
  if (!target) return
  const nextPerms = target.permissions.includes(permissionId)
    ? target.permissions.filter((p) => p !== permissionId)
    : [...target.permissions, permissionId]
  db.addLog(props.currentUser.username, '管理员', `微调权限: ${target.username} -> ${permissionId}`, 'Permissions', 'success')

  if (isSupabaseConfigured()) {
    const { ok, error } = await updateProfile(userId, { permissions: nextPerms })
    if (!ok) {
      alert(error ?? '更新失败')
      return
    }
    await loadUsers()
  } else {
    const updated = users.value.map((u) => (u.id === userId ? { ...u, permissions: nextPerms } : u))
    db.saveUsers(updated)
    users.value = updated
  }
  syncCurrentUserIfNeeded(userId)
}

async function handleDeleteUser(userId: string) {
  if (props.currentUser.role !== 'admin' || userId === props.currentUser.id) return
  const target = users.value.find((u) => u.id === userId)
  if (!target || !confirm(`确定删除用户 "${target.nickname}"？`)) return
  db.addLog(props.currentUser.username, '管理员', `删除用户: @${target.username}`, 'UserManage', 'success')

  if (isSupabaseConfigured()) {
    const { ok, error } = await deleteProfile(userId)
    if (!ok) {
      alert(error ?? '删除失败')
      return
    }
    await loadUsers()
  } else {
    const filtered = users.value.filter((u) => u.id !== userId)
    db.saveUsers(filtered)
    users.value = filtered
  }
}

function openAddModal() {
  if (isSupabaseConfigured()) {
    alert('Supabase 模式下请让用户通过注册页自行创建账号，管理员可在本页调整权限。')
    return
  }
  if (props.currentUser.role !== 'admin') {
    alert('仅超级管理员可新建用户')
    return
  }
  showAddModal.value = true
}

function handleCreateUser(e: Event) {
  e.preventDefault()
  if (!newUsername.value.trim() || !newNickname.value.trim() || !newEmail.value.trim()) return
  if (users.value.some((u) => u.username.toLowerCase() === newUsername.value.trim().toLowerCase())) {
    alert('用户名已被占用')
    return
  }
  const defaultPerms =
    newRole.value === 'admin'
      ? ['dashboard_view', 'data_stats_view', 'order_manage', 'user_manage', 'system_logs_view']
      : newRole.value === 'editor'
        ? ['dashboard_view', 'order_manage', 'data_stats_view']
        : ['dashboard_view', 'data_stats_view']

  const newUser: User = {
    id: `user_${Math.random().toString(36).substring(2, 9)}`,
    username: newUsername.value.trim(),
    nickname: newNickname.value.trim(),
    email: newEmail.value.trim(),
    role: newRole.value,
    permissions: defaultPerms,
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    createTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
  }
  const updated = [...users.value, newUser]
  db.saveUsers(updated)
  users.value = updated
  db.addLog(props.currentUser.username, '管理员', `创建用户: @${newUser.username}`, 'UserManage', 'success')
  showAddModal.value = false
  newUsername.value = ''
  newNickname.value = ''
  newEmail.value = ''
  newRole.value = 'viewer'
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <Users class="w-5 h-5 text-slate-800" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">系统用户与权限核算体系</h2>
          <p class="text-[11px] text-slate-500">动态监控及控制所有成员的模块权限和启用状态</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 justify-end">
        <div class="relative w-full sm:w-60">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input v-model="searchQuery" type="text" placeholder="搜索账号/昵称/邮箱..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800" />
        </div>
        <select v-model="roleFilter" class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
          <option value="all">任意角色</option>
          <option value="admin">超级管理员</option>
          <option value="editor">运营编辑</option>
          <option value="viewer">数据分析员</option>
        </select>
        <button
          class="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          @click="openAddModal"
        >
          <UserPlus class="w-3.5 h-3.5" /> 新建用户
        </button>
      </div>
    </div>

    <div v-if="currentUser.role !== 'admin'" class="p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-2.5">
      <ShieldAlert class="w-4.5 h-4.5 text-[#fa8231] shrink-0" />
      <p class="text-[11px] text-orange-700">只读保护模式：非管理员无法修改角色与权限。</p>
    </div>

    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs overflow-x-auto">
      <table class="w-full text-xs text-left min-w-3xl">
        <thead>
          <tr class="border-b border-slate-100 text-slate-400">
            <th class="py-3 px-2">人员详情</th>
            <th class="py-3 px-2">角色</th>
            <th class="py-3 px-2">状态</th>
            <th class="py-3 px-2">模块授权</th>
            <th class="py-3 px-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="!filteredUsers.length">
            <td colspan="5" class="py-8 text-center text-slate-400">无匹配用户</td>
          </tr>
          <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-slate-50/50">
            <td class="py-3.5 px-2">
              <div class="flex items-center gap-2.5">
                <img :src="u.avatar" class="w-9 h-9 rounded-full object-cover border" referrerpolicy="no-referrer" />
                <div>
                  <span class="font-semibold block">{{ u.nickname }}</span>
                  <span class="font-mono text-[10px] text-slate-400">@{{ u.username }}</span>
                </div>
              </div>
            </td>
            <td class="py-3.5 px-2">
              <select
                v-if="currentUser.role === 'admin'"
                :value="u.role"
                :disabled="u.id === currentUser.id"
                class="text-[11px] border rounded px-1.5 py-1"
                @change="handleRoleChange(u.id, ($event.target as HTMLSelectElement).value as User['role'])"
              >
                <option value="admin">超级管理员</option>
                <option value="editor">运营编辑</option>
                <option value="viewer">数据分析员</option>
              </select>
              <span v-else class="text-[10px] font-bold">{{ u.role }}</span>
            </td>
            <td class="py-3.5 px-2">
              <button
                :disabled="currentUser.role !== 'admin' || u.id === currentUser.id"
                class="text-[11px] font-bold flex items-center gap-1"
                @click="handleToggleStatus(u.id)"
              >
                {{ u.status === 'suspended' ? '已暂停' : '正常在行' }}
                <component :is="u.status === 'suspended' ? ToggleLeft : ToggleRight" v-if="currentUser.role === 'admin' && u.id !== currentUser.id" class="w-5 h-5" />
              </button>
            </td>
            <td class="py-3.5 px-2">
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="p in ALL_POSSIBLE_PERMISSIONS"
                  :key="p.id"
                  :disabled="currentUser.role !== 'admin' || u.id === currentUser.id"
                  class="px-1.5 py-0.5 rounded text-[10px] border"
                  :class="u.permissions.includes(p.id) ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400'"
                  @click="handleTogglePermission(u.id, p.id)"
                >
                  <Key v-if="u.permissions.includes(p.id)" class="w-2.5 h-2.5 inline" />
                  {{ p.label.replace('开通：', '') }}
                </button>
              </div>
            </td>
            <td class="py-3.5 px-2 text-right">
              <button
                v-if="currentUser.role === 'admin' && u.id !== currentUser.id"
                class="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"
                @click="handleDeleteUser(u.id)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddModal" class="fixed inset-0 bg-slate-950/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border">
            <div class="flex justify-between border-b pb-3 mb-4">
              <h3 class="font-space font-bold text-sm flex items-center gap-1.5"><UserPlus class="w-4.5 h-4.5" /> 新建协作人员</h3>
              <button @click="showAddModal = false"><X class="w-4.5 h-4.5" /></button>
            </div>
            <form class="space-y-4" @submit="handleCreateUser">
              <input v-model="newUsername" required placeholder="用户名" class="w-full px-3 py-2 border rounded-lg text-xs" />
              <input v-model="newNickname" required placeholder="昵称" class="w-full px-3 py-2 border rounded-lg text-xs" />
              <input v-model="newEmail" type="email" required placeholder="邮箱" class="w-full px-3 py-2 border rounded-lg text-xs" />
              <select v-model="newRole" class="w-full px-2 py-2 border rounded-lg text-xs">
                <option value="viewer">数据分析员</option>
                <option value="editor">运营编辑</option>
                <option value="admin">超级管理员</option>
              </select>
              <div class="flex gap-2 justify-end pt-4 border-t">
                <button type="button" class="px-3.5 py-1.5 bg-slate-100 rounded-lg text-xs" @click="showAddModal = false">取消</button>
                <button type="submit" class="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs">核发许可</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
