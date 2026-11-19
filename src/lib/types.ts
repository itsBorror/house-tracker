export type Base = {
  id: string
  household_id: string
  updated_at: string
  deleted?: boolean
  created_by?: string | null
  created_at?: string
}

export type Settings = Base & {
  categories: string[]
  worker_payday: number
}

export type ExpenseKind = 'expense' | 'supplier_payment' | 'worker_payment'

export type Expense = Base & {
  kind: ExpenseKind
  date: string
  amount: number
  category: string
  area_id: string | null
  paid_to: string | null
  note: string | null
  supplier_id: string | null
  worker_id: string | null
  work_item_id: string | null
  period: string | null
}

export type Supplier = Base & {
  name: string
  total_debt: number
  monthly_payment: number
  interest_rate: number
  window_start_day: number
  window_end_day: number
  start_month: string | null
  note: string | null
}

export type SupplierPurchase = Base & {
  supplier_id: string
  date: string
  amount: number
  note: string | null
}

export type Area = Base & { name: string; sort: number }

export type WorkStatus = 'todo' | 'in_progress' | 'done'

export type WorkItem = Base & {
  area_id: string
  title: string
  estimated_cost: number
  status: WorkStatus
  note: string | null
  sort: number
}

export type Worker = Base & {
  name: string
  trade: string | null
  agreed_total: number
  weekly_payment: number
  start_date: string | null
  area_id: string | null
  phone: string | null
  active: boolean
  note: string | null
}

export type PhotoKind = 'receipt' | 'task' | 'area' | 'document'

export type Photo = Base & {
  kind: PhotoKind
  ref_id: string | null
  area_id: string | null
  title: string | null
  date: string
  path: string
}

export type Tables = {
  settings: Settings
  areas: Area
  expenses: Expense
  suppliers: Supplier
  supplier_purchases: SupplierPurchase
  work_items: WorkItem
  workers: Worker
  photos: Photo
}

export type TableName = keyof Tables

export const TABLES: TableName[] = [
  'settings',
  'areas',
  'expenses',
  'suppliers',
  'supplier_purchases',
  'work_items',
  'workers',
  'photos',
]

export const DEFAULT_CATEGORIES = [
  'Labor',
  'Cement & Materials',
  'Electrical',
  'Plumbing',
  'Tiles',
  'Windows & Doors',
  'Painting',
  'Other',
]

export const STATUS_LABEL: Record<WorkStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}
