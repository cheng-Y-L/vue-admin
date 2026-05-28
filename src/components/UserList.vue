<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Users,
  Search,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from '@lucide/vue'
import { db } from '@/services/data'
import { isSupabaseConfigured } from '@/lib/supabase'
import { fetchAllProfiles, reviewLawyerCertification, updateProfile } from '@/services/profile.service'
import { roleLabel } from '@/constants/roles'
import { LAWYER_CERT_STATUS_LABELS } from '@/constants/lawyer-cert'
import { maskIdCard } from '@/utils/lawyer-cert'
import { getLawyerLicenseSignedUrl } from '@/services/lawyer-cert.service'
import type { User, LawyerCertificationStatus } from '@/types'

const props = defineProps<{ currentUser: User }>()

const users = ref<User[]>([])
const loading = ref(true)
const searchQuery = ref('')
const roleFilter = ref<'all' | User['role']>('all')
const statusFilter = ref<'all' | User['status']>('all')
const certFilter = ref<'all' | LawyerCertificationStatus | 'lawyers_only'>('all')
const selectedUser = ref<User | null>(null)
const reviewLoading = ref(false)
const statusToggleLoading = ref(false)
const licenseImagePreview = ref('')

watch(
  selectedUser,
  async (user) => {
    licenseImagePreview.value = ''
    if (!user?.licenseImageUrl) return
    if (isSupabaseConfigured()) {
      licenseImagePreview.value = (await getLawyerLicenseSignedUrl(user.licenseImageUrl)) ?? ''
      return
    }
    licenseImagePreview.value = user.licenseImageUrl
  },
  { immediate: true },
)

async function loadUsers() {
  loading.value = true
  try {
    if (isSupabaseConfigured()) {
      users.value = await fetchAllProfiles()
    } else {
      users.value = db.getUsers()
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUsers()
})

const pendingCount = computed(
  () => users.value.filter((u) => u.role === 'lawyer' && u.certificationStatus === 'pending').length,
)

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return users.value.filter((u) => {
    const matchesSearch =
      !query ||
      u.username.toLowerCase().includes(query) ||
      u.nickname.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.phone?.toLowerCase().includes(query) ?? false) ||
      (u.realName?.toLowerCase().includes(query) ?? false)

    const matchesRole = roleFilter.value === 'all' || u.role === roleFilter.value
    const matchesStatus = statusFilter.value === 'all' || u.status === statusFilter.value

    let matchesCert = true
    if (certFilter.value === 'lawyers_only') {
      matchesCert = u.role === 'lawyer'
    } else if (certFilter.value !== 'all') {
      matchesCert = u.role === 'lawyer' && u.certificationStatus === certFilter.value
    }

    return matchesSearch && matchesRole && matchesStatus && matchesCert
  })
})

function certBadgeClass(status: LawyerCertificationStatus) {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-800 border-amber-100'
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 border-emerald-100'
    case 'rejected':
      return 'bg-red-50 text-red-700 border-red-100'
    default:
      return 'bg-slate-50 text-slate-500 border-slate-100'
  }
}

function openProfile(user: User) {
  selectedUser.value = user
}

function closeProfile() {
  selectedUser.value = null
}

function refreshSelected(userId: string) {
  const updated = users.value.find((u) => u.id === userId)
  if (updated && selectedUser.value?.id === userId) {
    selectedUser.value = updated
  }
}

async function handleCertificationChange(userId: string, status: LawyerCertificationStatus) {
  const target = users.value.find((u) => u.id === userId)
  if (!target || target.role !== 'lawyer') return

  db.addLog(
    props.currentUser.username,
    '管理员',
    `更新律师资质: ${target.username} -> ${LAWYER_CERT_STATUS_LABELS[status]}`,
    'UserManage',
    'success',
  )

  if (isSupabaseConfigured()) {
    const { ok, error } = await updateProfile(userId, { certificationStatus: status })
    if (!ok) {
      alert(error ?? '更新失败')
      return
    }
    await loadUsers()
  } else {
    const updated = users.value.map((u) => (u.id === userId ? { ...u, certificationStatus: status } : u))
    db.saveUsers(updated)
    users.value = updated
  }
  refreshSelected(userId)
}

async function handleReview(userId: string, status: 'approved' | 'rejected') {
  const target = users.value.find((u) => u.id === userId)
  if (!target || target.role !== 'lawyer') return

  const actionLabel = status === 'approved' ? '通过' : '驳回'
  if (!confirm(`确定${actionLabel}律师「${target.nickname}」的资质认证申请？`)) return

  reviewLoading.value = true
  db.addLog(
    props.currentUser.username,
    '管理员',
    `审核律师资质: ${target.username} -> ${LAWYER_CERT_STATUS_LABELS[status]}`,
    'UserManage',
    'success',
  )

  try {
    if (isSupabaseConfigured()) {
      const { ok, error } = await reviewLawyerCertification(userId, status)
      if (!ok) {
        alert(error ?? '审核失败')
        return
      }
      await loadUsers()
    } else {
      const updated = users.value.map((u) =>
        u.id === userId ? { ...u, certificationStatus: status } : u,
      )
      db.saveUsers(updated)
      users.value = updated
    }
    refreshSelected(userId)
  } finally {
    reviewLoading.value = false
  }
}

function statusLabel(status: User['status']) {
  return status === 'suspended' ? '已禁用' : '正常'
}

async function handleToggleStatus(userId: string) {
  if (userId === props.currentUser.id) {
    alert('不能禁用当前登录的管理员账号')
    return
  }
  const target = users.value.find((u) => u.id === userId)
  if (!target) return

  const nextStatus = target.status === 'active' ? 'suspended' : 'active'
  const actionLabel = nextStatus === 'suspended' ? '禁用' : '启用'
  if (!confirm(`确定${actionLabel}用户「${target.nickname}」？${nextStatus === 'suspended' ? '禁用后该用户将无法登录。' : ''}`)) return

  statusToggleLoading.value = true
  db.addLog(
    props.currentUser.username,
    '管理员',
    `${actionLabel}用户: ${target.username}`,
    'UserManage',
    'success',
  )

  try {
    if (isSupabaseConfigured()) {
      const { ok, error } = await updateProfile(userId, { status: nextStatus })
      if (!ok) {
        alert(error ?? '更新失败')
        return
      }
      await loadUsers()
    } else {
      const updated = users.value.map((u) =>
        u.id === userId ? { ...u, status: nextStatus as User['status'] } : u,
      )
      db.saveUsers(updated)
      users.value = updated
    }
    refreshSelected(userId)
  } finally {
    statusToggleLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <Users class="w-5 h-5 text-slate-800" />
        <div>
          <h2 class="font-space font-bold text-sm text-slate-900">用户列表</h2>
          <p class="text-[11px] text-slate-500">查看全部用户资料，审核律师资质，禁用/启用账号</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 justify-end w-full sm:w-auto">
        <div class="relative w-full sm:w-56">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索账号/昵称/邮箱/手机..."
            class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
          />
        </div>
        <select v-model="roleFilter" class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
          <option value="all">全部角色</option>
          <option value="admin">超级管理员</option>
          <option value="publisher">发布侧</option>
          <option value="lawyer">律师</option>
        </select>
        <select v-model="statusFilter" class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
          <option value="all">全部状态</option>
          <option value="active">正常</option>
          <option value="suspended">已禁用</option>
        </select>
        <select v-model="certFilter" class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
          <option value="all">全部资质</option>
          <option value="lawyers_only">仅律师</option>
          <option value="pending">待审核</option>
          <option value="approved">已认证</option>
          <option value="rejected">已驳回</option>
          <option value="none">未提交</option>
        </select>
      </div>
    </div>

    <div v-if="pendingCount > 0" class="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2.5 text-[11px] text-amber-800">
      <Clock class="w-4 h-4 shrink-0" />
      <span>当前有 <b>{{ pendingCount }}</b> 位律师资质认证待审核，请尽快处理。</span>
      <button
        type="button"
        class="ml-auto text-[10px] font-bold underline"
        @click="certFilter = 'pending'"
      >
        仅看待审核
      </button>
    </div>

    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs overflow-x-auto">
      <div v-if="loading" class="py-12 flex justify-center text-slate-400">
        <Loader2 class="w-6 h-6 animate-spin" />
      </div>
      <table v-else class="w-full text-xs text-left min-w-4xl">
        <thead>
          <tr class="border-b border-slate-100 text-slate-400">
            <th class="py-3 px-2">用户</th>
            <th class="py-3 px-2">角色</th>
            <th class="py-3 px-2">联系方式</th>
            <th class="py-3 px-2">资质认证</th>
            <th class="py-3 px-2">账号状态</th>
            <th class="py-3 px-2">注册时间</th>
            <th class="py-3 px-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="!filteredUsers.length">
            <td colspan="7" class="py-8 text-center text-slate-400">无匹配用户</td>
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
              <span class="text-[11px] font-semibold">{{ roleLabel(u.role) }}</span>
            </td>
            <td class="py-3.5 px-2">
              <div class="text-[11px] text-slate-600 space-y-0.5">
                <div>{{ u.email || '—' }}</div>
                <div class="text-slate-400">{{ u.phone || '未绑定手机' }}</div>
              </div>
            </td>
            <td class="py-3.5 px-2">
              <template v-if="u.role === 'lawyer'">
                <select
                  :value="u.certificationStatus"
                  class="text-[11px] border rounded px-1.5 py-1 max-w-24 mb-1 block"
                  @change="handleCertificationChange(u.id, ($event.target as HTMLSelectElement).value as LawyerCertificationStatus)"
                >
                  <option v-for="(label, key) in LAWYER_CERT_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
                <div v-if="u.certificationStatus === 'pending'" class="flex gap-1">
                  <button
                    type="button"
                    :disabled="reviewLoading"
                    class="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    title="通过认证"
                    @click="handleReview(u.id, 'approved')"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    :disabled="reviewLoading"
                    class="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                    title="驳回认证"
                    @click="handleReview(u.id, 'rejected')"
                  >
                    <XCircle class="w-3.5 h-3.5" />
                  </button>
                </div>
              </template>
              <span v-else class="text-[10px] text-slate-300">—</span>
            </td>
            <td class="py-3.5 px-2">
              <button
                type="button"
                :disabled="statusToggleLoading || u.id === currentUser.id"
                class="text-[10px] font-bold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                :class="u.status === 'suspended' ? 'text-red-600' : 'text-emerald-700'"
                @click="handleToggleStatus(u.id)"
              >
                {{ statusLabel(u.status) }}
                <component
                  :is="u.status === 'suspended' ? ToggleLeft : ToggleRight"
                  v-if="u.id !== currentUser.id"
                  class="w-4 h-4"
                />
              </button>
            </td>
            <td class="py-3.5 px-2 text-[10px] text-slate-500 font-mono">{{ u.createTime }}</td>
            <td class="py-3.5 px-2 text-right">
              <div class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  class="px-2 py-1 text-[10px] font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                  @click="openProfile(u)"
                >
                  <Eye class="w-3.5 h-3.5" /> 查看资料
                </button>
                <button
                  v-if="u.id !== currentUser.id"
                  type="button"
                  :disabled="statusToggleLoading"
                  class="px-2 py-1 text-[10px] font-semibold rounded-lg border flex items-center gap-1 disabled:opacity-50"
                  :class="u.status === 'suspended'
                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    : 'border-red-200 text-red-600 hover:bg-red-50'"
                  @click="handleToggleStatus(u.id)"
                >
                  {{ u.status === 'suspended' ? '启用' : '禁用' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="selectedUser"
          class="fixed inset-0 bg-slate-950/30 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          @click.self="closeProfile"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full border max-h-[90vh] overflow-y-auto">
            <div class="p-5 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white z-10">
              <div class="flex items-center gap-3">
                <img
                  :src="selectedUser.avatar"
                  class="w-12 h-12 rounded-full object-cover border"
                  referrerpolicy="no-referrer"
                />
                <div>
                  <h3 class="font-space font-bold text-sm text-slate-900">{{ selectedUser.nickname }}</h3>
                  <p class="text-[11px] text-slate-500 font-mono">@{{ selectedUser.username }}</p>
                </div>
              </div>
              <button type="button" class="p-1.5 hover:bg-slate-100 rounded-lg" @click="closeProfile">
                <X class="w-4.5 h-4.5" />
              </button>
            </div>

            <div class="p-5 space-y-5">
              <section>
                <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">基本信息</h4>
                <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt class="text-slate-400">角色</dt>
                    <dd class="font-semibold">{{ roleLabel(selectedUser.role) }}</dd>
                  </div>
                  <div>
                    <dt class="text-slate-400">账号状态</dt>
                    <dd class="font-semibold flex items-center gap-2">
                      <span :class="selectedUser.status === 'suspended' ? 'text-red-600' : 'text-emerald-700'">
                        {{ statusLabel(selectedUser.status) }}
                      </span>
                      <button
                        v-if="selectedUser.id !== currentUser.id"
                        type="button"
                        :disabled="statusToggleLoading"
                        class="text-[10px] font-bold px-2 py-0.5 rounded-lg border disabled:opacity-50"
                        :class="selectedUser.status === 'suspended'
                          ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          : 'border-red-200 text-red-600 hover:bg-red-50'"
                        @click="handleToggleStatus(selectedUser.id)"
                      >
                        {{ selectedUser.status === 'suspended' ? '启用账号' : '禁用账号' }}
                      </button>
                    </dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-slate-400">邮箱</dt>
                    <dd class="font-medium break-all">{{ selectedUser.email || '—' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-slate-400">手机号</dt>
                    <dd class="font-medium">{{ selectedUser.phone || '未绑定' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-slate-400">注册时间</dt>
                    <dd class="font-mono text-[11px]">{{ selectedUser.createTime }}</dd>
                  </div>
                </dl>
              </section>

              <section v-if="selectedUser.role === 'lawyer'">
                <div class="flex items-center gap-2 mb-2">
                  <ShieldCheck class="w-4 h-4 text-slate-600" />
                  <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">律师资质与执业资料</h4>
                  <span
                    class="ml-auto inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    :class="certBadgeClass(selectedUser.certificationStatus)"
                  >
                    {{ LAWYER_CERT_STATUS_LABELS[selectedUser.certificationStatus] }}
                  </span>
                </div>
                <dl class="grid grid-cols-1 gap-y-2 text-xs bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div class="grid grid-cols-3 gap-2">
                    <dt class="text-slate-400">真实姓名</dt>
                    <dd class="col-span-2 font-semibold">{{ selectedUser.realName || '未填写' }}</dd>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <dt class="text-slate-400">身份证号</dt>
                    <dd class="col-span-2 font-mono">{{ selectedUser.idCard || '未填写' }}</dd>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <dt class="text-slate-400">执业机构</dt>
                    <dd class="col-span-2">{{ selectedUser.lawFirm || '未填写' }}</dd>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <dt class="text-slate-400">执业证号</dt>
                    <dd class="col-span-2 font-mono">{{ selectedUser.licenseNumber || '未填写' }}</dd>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <dt class="text-slate-400">执业领域</dt>
                    <dd class="col-span-2">{{ selectedUser.practiceArea || '未填写' }}</dd>
                  </div>
                  <div v-if="licenseImagePreview" class="col-span-full pt-2">
                    <dt class="text-slate-400 mb-2">律师执业证照片</dt>
                    <dd>
                      <a :href="licenseImagePreview" target="_blank" rel="noopener noreferrer" class="block">
                        <img
                          :src="licenseImagePreview"
                          alt="律师执业证"
                          class="w-full max-h-48 object-contain rounded-lg border border-slate-200 bg-white"
                        />
                      </a>
                    </dd>
                  </div>
                  <div v-else-if="selectedUser.licenseImageUrl" class="col-span-full text-[11px] text-slate-400">
                    律师证照片加载中…
                  </div>
                  <div v-else class="col-span-full text-[11px] text-slate-400">未上传律师执业证照片</div>
                </dl>
                <p class="text-[10px] text-slate-400 mt-2">列表中身份证显示为：{{ maskIdCard(selectedUser.idCard) }}</p>

                <div class="mt-3">
                  <label class="text-[10px] text-slate-400 block mb-1">调整认证状态</label>
                  <select
                    :value="selectedUser.certificationStatus"
                    class="w-full text-xs border rounded-lg px-2 py-1.5"
                    @change="handleCertificationChange(selectedUser.id, ($event.target as HTMLSelectElement).value as LawyerCertificationStatus)"
                  >
                    <option v-for="(label, key) in LAWYER_CERT_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
                  </select>
                </div>

                <div
                  v-if="selectedUser.certificationStatus === 'pending'"
                  class="mt-4 flex gap-2 pt-4 border-t border-slate-100"
                >
                  <button
                    type="button"
                    :disabled="reviewLoading"
                    class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                    @click="handleReview(selectedUser.id, 'approved')"
                  >
                    <CheckCircle2 class="w-4 h-4" /> 通过认证
                  </button>
                  <button
                    type="button"
                    :disabled="reviewLoading"
                    class="flex-1 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                    @click="handleReview(selectedUser.id, 'rejected')"
                  >
                    <XCircle class="w-4 h-4" /> 驳回申请
                  </button>
                </div>
              </section>

              <section v-else>
                <p class="text-[11px] text-slate-400">该用户非律师角色，无需资质认证。</p>
              </section>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
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
