/**
 * Offline-first data store.
 *
 * Every change is saved on the phone first (localStorage) and put in an
 * "outbox". When the phone is online the outbox is sent to Supabase, then the
 * latest data is pulled back. Supabase Realtime tells us when the other person
 * changed something, so both phones stay in step.
 */
import { useMemo, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { DEFAULT_CATEGORIES, TABLES, type TableName, type Tables } from './types'

type DataMap = { [K in TableName]: Record<string, Tables[K]> }
type OutboxItem = { table: TableName; row: Record<string, unknown> }

export type StoreState = {
  householdId: string | null
  userId: string | null
  data: DataMap
  outbox: OutboxItem[]
  lastSync: string | null
  syncing: boolean
  online: boolean
  error: string | null
}

const emptyData = (): DataMap =>
  Object.fromEntries(TABLES.map((t) => [t, {}])) as unknown as DataMap

let state: StoreState = {
  householdId: null,
  userId: null,
  data: emptyData(),
  outbox: [],
  lastSync: null,
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  error: null,
}

const listeners = new Set<() => void>()
function set(patch: Partial<StoreState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const storageKey = (hid: string) => `ht:v1:${hid}`

function persist() {
  if (!state.householdId) return
  try {
    localStorage.setItem(
      storageKey(state.householdId),
      JSON.stringify({ data: state.data, outbox: state.outbox, lastSync: state.lastSync }),
    )
  } catch {
    /* storage full or blocked: data still lives in memory and in Supabase */
  }
}

function load(hid: string) {
  try {
    const raw = localStorage.getItem(storageKey(hid))
    if (!raw) return
    const saved = JSON.parse(raw)
    set({ data: { ...emptyData(), ...saved.data }, outbox: saved.outbox || [], lastSync: saved.lastSync || null })
  } catch {
    /* ignore a corrupt cache; the next pull rebuilds it */
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------
let channel: ReturnType<typeof supabase.channel> | null = null
let pullTimer: number | undefined
let running = false
const afterFlushHooks: Array<() => Promise<void>> = []
export function onAfterFlush(fn: () => Promise<void>) {
  afterFlushHooks.push(fn)
}
let again = false

function isNetworkError(err: { message?: string } | null, status?: number) {
  if (!navigator.onLine) return true
  if (status === 0) return true
  return /fetch|network|load failed|timed? ?out/i.test(err?.message || '')
}

async function flush(): Promise<boolean> {
  while (state.outbox.length) {
    const item = state.outbox[0]
    const { error, status } = await supabase.from(item.table).upsert(item.row)
    if (error) {
      if (isNetworkError(error, status)) return false
      // A real rejection (e.g. invalid value). Drop it so the queue is not stuck,
      // and tell the user.
      set({ error: `Could not save a change: ${error.message}` })
    }
    set({ outbox: state.outbox.slice(1) })
    persist()
  }
  return true
}

async function pullTable<K extends TableName>(table: K, hid: string): Promise<Record<string, Tables[K]>> {
  const out: Record<string, Tables[K]> = {}
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('household_id', hid)
      .range(from, from + page - 1)
    if (error) throw error
    for (const r of data as Tables[K][]) out[r.id] = normalize(r)
    if (!data || data.length < page) break
  }
  return out
}

// Postgres numeric columns can arrive as strings; make them numbers.
const NUMERIC = new Set(['amount', 'total_debt', 'monthly_payment', 'interest_rate', 'estimated_cost', 'agreed_total', 'weekly_payment'])
function normalize<T>(r: T): T {
  const o = r as Record<string, unknown>
  for (const k of Object.keys(o)) if (NUMERIC.has(k) && o[k] != null) o[k] = Number(o[k])
  return r
}

async function pull() {
  const hid = state.householdId
  if (!hid) return
  const results = await Promise.all(TABLES.map((t) => pullTable(t, hid)))
  if (state.householdId !== hid) return
  const data = Object.fromEntries(TABLES.map((t, i) => [t, results[i]])) as unknown as DataMap
  // Keep local changes that have not reached the server yet.
  for (const item of state.outbox) {
    ;(data[item.table] as Record<string, unknown>)[item.row.id as string] = item.row
  }
  set({ data, lastSync: new Date().toISOString() })
  persist()
}

export async function sync() {
  if (!state.householdId) return
  if (running) {
    again = true
    return
  }
  running = true
  set({ syncing: true })
  try {
    do {
      again = false
      const flushed = await flush()
      if (flushed) {
        for (const h of afterFlushHooks) await h().catch(() => undefined)
        await pull()
      }
    } while (again)
    set({ online: true })
  } catch (e) {
    const err = e as { message?: string }
    if (isNetworkError(err)) set({ online: false })
    else set({ error: err.message || 'Sync failed' })
  } finally {
    running = false
    set({ syncing: false })
  }
}

function schedulePull(ms = 400) {
  window.clearTimeout(pullTimer)
  pullTimer = window.setTimeout(sync, ms)
}

function onOnline() {
  set({ online: true })
  sync()
}
function onOffline() {
  set({ online: false })
}
function onVisible() {
  if (document.visibilityState === 'visible') sync()
}

export function startStore(householdId: string, userId: string) {
  if (state.householdId === householdId) return
  stopStore()
  set({ householdId, userId, data: emptyData(), outbox: [], lastSync: null, error: null })
  load(householdId)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  channel = supabase
    .channel(`household-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public' }, () => schedulePull())
    .subscribe()
  sync()
}

export function stopStore() {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onVisible)
  if (channel) supabase.removeChannel(channel)
  channel = null
  set({ householdId: null, userId: null, data: emptyData(), outbox: [] })
}

export function clearError() {
  set({ error: null })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
type Input<K extends TableName> = Partial<Tables[K]> & { id?: string }

export function save<K extends TableName>(table: K, input: Input<K>): Tables[K] {
  const hid = state.householdId
  if (!hid) throw new Error('No household')
  const existing = input.id ? (state.data[table][input.id] as Tables[K] | undefined) : undefined
  const row = {
    ...(existing || { created_by: state.userId, deleted: false }),
    ...input,
    id: input.id || crypto.randomUUID(),
    household_id: hid,
    updated_at: new Date().toISOString(),
  } as Tables[K]
  const tableData = { ...state.data[table], [row.id]: row }
  const outbox = state.outbox.filter((o) => !(o.table === table && o.row.id === row.id))
  outbox.push({ table, row: row as unknown as Record<string, unknown> })
  set({ data: { ...state.data, [table]: tableData }, outbox })
  persist()
  sync()
  return row
}

export function remove(table: TableName, id: string) {
  save(table, { id, deleted: true } as Input<typeof table>)
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------
export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, () => state)
}

export function useRows<K extends TableName>(table: K): Tables[K][] {
  const s = useStore()
  const map = s.data[table]
  return useMemo(() => Object.values(map).filter((r) => !r.deleted) as Tables[K][], [map])
}

export function useSettings() {
  const s = useStore()
  const row = s.householdId ? s.data.settings[s.householdId] : undefined
  return {
    categories: row?.categories?.length ? row.categories : DEFAULT_CATEGORIES,
    worker_payday: row?.worker_payday ?? 6,
  }
}

export function saveSettings(patch: Partial<Tables['settings']>) {
  const hid = state.householdId
  if (!hid) return
  const current = state.data.settings[hid]
  save('settings', {
    categories: current?.categories?.length ? current.categories : DEFAULT_CATEGORIES,
    worker_payday: current?.worker_payday ?? 6,
    ...patch,
    id: hid,
  })
}

export function getState() {
  return state
}
