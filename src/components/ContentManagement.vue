<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Tags, MapPin, Plus, Pencil, Loader2, Check, X } from '@lucide/vue'
import {
  fetchTaskCategories,
  fetchTaskRegions,
  saveTaskCategory,
  saveTaskRegion,
  type TaskCategoryItem,
  type TaskRegionItem,
} from '@/services/taxonomy.service'
import { db } from '@/services/data'
import type { User } from '@/types'

const props = defineProps<{ currentUser: User }>()

const tab = ref<'categories' | 'regions'>('categories')
const categories = ref<TaskCategoryItem[]>([])
const regions = ref<TaskRegionItem[]>([])
const loading = ref(true)
const saving = ref(false)

const editingCategory = ref<Partial<TaskCategoryItem> | null>(null)
const editingRegion = ref<Partial<TaskRegionItem> | null>(null)

onMounted(load)

async function load() {
  loading.value = true
  const [cats, regs] = await Promise.all([
    fetchTaskCategories(true),
    fetchTaskRegions(true),
  ])
  categories.value = cats
  regions.value = regs
  loading.value = false
}

function startAddCategory() {
  editingCategory.value = { name: '', color: '#94a3b8', sortOrder: categories.value.length + 1, isActive: true }
}

function startEditCategory(c: TaskCategoryItem) {
  editingCategory.value = { ...c }
}

function startAddRegion() {
  editingRegion.value = { name: '', sortOrder: regions.value.length + 1, isActive: true }
}

function startEditRegion(r: TaskRegionItem) {
  editingRegion.value = { ...r }
}

async function saveCategoryForm() {
  if (!editingCategory.value?.name?.trim()) {
    alert('请填写分类名称')
    return
  }
  saving.value = true
  db.addLog(props.currentUser.username, '管理员', `保存任务分类: ${editingCategory.value.name}`, 'ContentManage', 'success')
  const { ok, error } = await saveTaskCategory(editingCategory.value as TaskCategoryItem)
  saving.value = false
  if (!ok) {
    alert(error ?? '保存失败')
    return
  }
  editingCategory.value = null
  await load()
}

async function saveRegionForm() {
  if (!editingRegion.value?.name?.trim()) {
    alert('请填写地域名称')
    return
  }
  saving.value = true
  db.addLog(props.currentUser.username, '管理员', `保存任务地域: ${editingRegion.value.name}`, 'ContentManage', 'success')
  const { ok, error } = await saveTaskRegion(editingRegion.value as TaskRegionItem)
  saving.value = false
  if (!ok) {
    alert(error ?? '保存失败')
    return
  }
  editingRegion.value = null
  await load()
}

async function toggleCategoryActive(c: TaskCategoryItem) {
  const { ok, error } = await saveTaskCategory({ ...c, isActive: !c.isActive })
  if (!ok) alert(error ?? '更新失败')
  else await load()
}

async function toggleRegionActive(r: TaskRegionItem) {
  const { ok, error } = await saveTaskRegion({ ...r, isActive: !r.isActive })
  if (!ok) alert(error ?? '更新失败')
  else await load()
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
      <h2 class="font-space font-bold text-sm text-slate-900">内容管理</h2>
      <p class="text-[11px] text-slate-500 mt-0.5">管理任务分类、地域等基础数据</p>
      <div class="flex gap-2 mt-4">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5"
          :class="tab === 'categories' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200'"
          @click="tab = 'categories'"
        >
          <Tags class="w-3.5 h-3.5" /> 任务分类
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5"
          :class="tab === 'regions' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200'"
          @click="tab = 'regions'"
        >
          <MapPin class="w-3.5 h-3.5" /> 服务地域
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-12 flex justify-center text-slate-400">
      <Loader2 class="w-6 h-6 animate-spin" />
    </div>

    <!-- 任务分类 -->
    <div v-else-if="tab === 'categories'" class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xs font-bold text-slate-700">任务分类列表</h3>
        <button
          type="button"
          class="px-2.5 py-1 text-[10px] font-bold bg-slate-900 text-white rounded-lg flex items-center gap-1"
          @click="startAddCategory"
        >
          <Plus class="w-3 h-3" /> 新增分类
        </button>
      </div>

      <div v-if="editingCategory" class="mb-4 p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <input v-model="editingCategory.name" placeholder="分类名称" class="text-xs border rounded-lg px-2 py-1.5 col-span-2" />
          <input v-model="editingCategory.color" type="color" class="h-9 w-full border rounded-lg cursor-pointer" />
          <input v-model.number="editingCategory.sortOrder" type="number" placeholder="排序" class="text-xs border rounded-lg px-2 py-1.5" />
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="saving"
            class="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
            @click="saveCategoryForm"
          >
            <Check class="w-3.5 h-3.5" /> 保存
          </button>
          <button type="button" class="px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1" @click="editingCategory = null">
            <X class="w-3.5 h-3.5" /> 取消
          </button>
        </div>
      </div>

      <table class="w-full text-xs">
        <thead>
          <tr class="border-b text-slate-400">
            <th class="py-2 text-left">名称</th>
            <th class="py-2 text-left">颜色</th>
            <th class="py-2 text-center">排序</th>
            <th class="py-2 text-center">状态</th>
            <th class="py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="c in categories" :key="c.id">
            <td class="py-2.5 font-semibold">{{ c.name }}</td>
            <td class="py-2.5">
              <span class="inline-block w-5 h-5 rounded border" :style="{ backgroundColor: c.color }" />
            </td>
            <td class="py-2.5 text-center font-mono">{{ c.sortOrder }}</td>
            <td class="py-2.5 text-center">
              <button
                type="button"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                :class="c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'"
                @click="toggleCategoryActive(c)"
              >
                {{ c.isActive ? '启用' : '停用' }}
              </button>
            </td>
            <td class="py-2.5 text-right">
              <button type="button" class="p-1 hover:bg-slate-100 rounded" @click="startEditCategory(c)">
                <Pencil class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 服务地域 -->
    <div v-else class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xs font-bold text-slate-700">服务地域列表</h3>
        <button
          type="button"
          class="px-2.5 py-1 text-[10px] font-bold bg-slate-900 text-white rounded-lg flex items-center gap-1"
          @click="startAddRegion"
        >
          <Plus class="w-3 h-3" /> 新增地域
        </button>
      </div>

      <div v-if="editingRegion" class="mb-4 p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input v-model="editingRegion.name" placeholder="地域名称" class="text-xs border rounded-lg px-2 py-1.5 col-span-2" />
          <input v-model.number="editingRegion.sortOrder" type="number" placeholder="排序" class="text-xs border rounded-lg px-2 py-1.5" />
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="saving"
            class="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
            @click="saveRegionForm"
          >
            <Check class="w-3.5 h-3.5" /> 保存
          </button>
          <button type="button" class="px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1" @click="editingRegion = null">
            <X class="w-3.5 h-3.5" /> 取消
          </button>
        </div>
      </div>

      <table class="w-full text-xs">
        <thead>
          <tr class="border-b text-slate-400">
            <th class="py-2 text-left">名称</th>
            <th class="py-2 text-center">排序</th>
            <th class="py-2 text-center">状态</th>
            <th class="py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="r in regions" :key="r.id">
            <td class="py-2.5 font-semibold">{{ r.name }}</td>
            <td class="py-2.5 text-center font-mono">{{ r.sortOrder }}</td>
            <td class="py-2.5 text-center">
              <button
                type="button"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                :class="r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'"
                @click="toggleRegionActive(r)"
              >
                {{ r.isActive ? '启用' : '停用' }}
              </button>
            </td>
            <td class="py-2.5 text-right">
              <button type="button" class="p-1 hover:bg-slate-100 rounded" @click="startEditRegion(r)">
                <Pencil class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
