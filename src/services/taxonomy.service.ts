import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { TASK_TYPE_COLORS, TASK_TYPES, TASK_REGIONS } from '@/constants/tasks'
import type { Database } from '@/types/database'

type CategoryRow = Database['public']['Tables']['task_categories']['Row']
type RegionRow = Database['public']['Tables']['task_regions']['Row']

export interface TaskCategoryItem {
  id: string
  name: string
  color: string
  sortOrder: number
  isActive: boolean
}

export interface TaskRegionItem {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

const LOCAL_CATEGORIES_KEY = 'admin_task_categories'
const LOCAL_REGIONS_KEY = 'admin_task_regions'

function defaultCategories(): TaskCategoryItem[] {
  return TASK_TYPES.map((name, i) => ({
    id: `cat_${i}`,
    name,
    color: TASK_TYPE_COLORS[name] ?? '#94a3b8',
    sortOrder: i + 1,
    isActive: true,
  }))
}

function defaultRegions(): TaskRegionItem[] {
  return TASK_REGIONS.map((name, i) => ({
    id: `reg_${i}`,
    name,
    sortOrder: i + 1,
    isActive: true,
  }))
}

function mapCategoryRow(row: CategoryRow): TaskCategoryItem {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

function mapRegionRow(row: RegionRow): TaskRegionItem {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

function readLocalCategories(): TaskCategoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CATEGORIES_KEY)
    if (raw) return JSON.parse(raw) as TaskCategoryItem[]
  } catch {
    /* ignore */
  }
  return defaultCategories()
}

function readLocalRegions(): TaskRegionItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_REGIONS_KEY)
    if (raw) return JSON.parse(raw) as TaskRegionItem[]
  } catch {
    /* ignore */
  }
  return defaultRegions()
}

function writeLocalCategories(items: TaskCategoryItem[]) {
  localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(items))
}

function writeLocalRegions(items: TaskRegionItem[]) {
  localStorage.setItem(LOCAL_REGIONS_KEY, JSON.stringify(items))
}

export async function fetchTaskCategories(includeInactive = false): Promise<TaskCategoryItem[]> {
  if (!isSupabaseConfigured()) {
    const items = readLocalCategories()
    return includeInactive ? items : items.filter((c) => c.isActive)
  }

  let query = supabase.from('task_categories').select('*').order('sort_order').order('name')
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error || !data?.length) return defaultCategories()
  return data.map(mapCategoryRow)
}

export async function fetchTaskRegions(includeInactive = false): Promise<TaskRegionItem[]> {
  if (!isSupabaseConfigured()) {
    const items = readLocalRegions()
    return includeInactive ? items : items.filter((r) => r.isActive)
  }

  let query = supabase.from('task_regions').select('*').order('sort_order').order('name')
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error || !data?.length) return defaultRegions()
  return data.map(mapRegionRow)
}

export async function fetchActiveTaskTypeNames(): Promise<string[]> {
  const cats = await fetchTaskCategories(false)
  return cats.map((c) => c.name)
}

export async function fetchActiveTaskRegionNames(): Promise<string[]> {
  const regions = await fetchTaskRegions(false)
  return regions.map((r) => r.name)
}

export async function saveTaskCategory(
  item: Omit<TaskCategoryItem, 'id'> & { id?: string },
): Promise<{ ok: boolean; error: string | null }> {
  if (!item.name.trim()) return { ok: false, error: '分类名称不能为空' }

  if (!isSupabaseConfigured()) {
    const items = readLocalCategories()
    if (item.id) {
      const idx = items.findIndex((c) => c.id === item.id)
      if (idx < 0) return { ok: false, error: '分类不存在' }
      if (items.some((c) => c.id !== item.id && c.name === item.name.trim())) {
        return { ok: false, error: '分类名称已存在' }
      }
      items[idx] = { ...items[idx], ...item, name: item.name.trim() }
    } else {
      if (items.some((c) => c.name === item.name.trim())) return { ok: false, error: '分类名称已存在' }
      items.push({
        id: `cat_${Date.now()}`,
        name: item.name.trim(),
        color: item.color,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      })
    }
    writeLocalCategories(items)
    return { ok: true, error: null }
  }

  if (item.id) {
    const { error } = await supabase
      .from('task_categories')
      .update({
        name: item.name.trim(),
        color: item.color,
        sort_order: item.sortOrder,
        is_active: item.isActive,
      })
      .eq('id', item.id)
    return { ok: !error, error: error?.message ?? null }
  }

  const { error } = await supabase.from('task_categories').insert({
    name: item.name.trim(),
    color: item.color,
    sort_order: item.sortOrder,
    is_active: item.isActive,
  })
  return { ok: !error, error: error?.message ?? null }
}

export async function saveTaskRegion(
  item: Omit<TaskRegionItem, 'id'> & { id?: string },
): Promise<{ ok: boolean; error: string | null }> {
  if (!item.name.trim()) return { ok: false, error: '地域名称不能为空' }

  if (!isSupabaseConfigured()) {
    const items = readLocalRegions()
    if (item.id) {
      const idx = items.findIndex((r) => r.id === item.id)
      if (idx < 0) return { ok: false, error: '地域不存在' }
      if (items.some((r) => r.id !== item.id && r.name === item.name.trim())) {
        return { ok: false, error: '地域名称已存在' }
      }
      items[idx] = { ...items[idx], ...item, name: item.name.trim() }
    } else {
      if (items.some((r) => r.name === item.name.trim())) return { ok: false, error: '地域名称已存在' }
      items.push({
        id: `reg_${Date.now()}`,
        name: item.name.trim(),
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      })
    }
    writeLocalRegions(items)
    return { ok: true, error: null }
  }

  if (item.id) {
    const { error } = await supabase
      .from('task_regions')
      .update({
        name: item.name.trim(),
        sort_order: item.sortOrder,
        is_active: item.isActive,
      })
      .eq('id', item.id)
    return { ok: !error, error: error?.message ?? null }
  }

  const { error } = await supabase.from('task_regions').insert({
    name: item.name.trim(),
    sort_order: item.sortOrder,
    is_active: item.isActive,
  })
  return { ok: !error, error: error?.message ?? null }
}
