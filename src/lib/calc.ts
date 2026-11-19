/** All dashboard numbers are derived here from the raw rows, never stored. */
import { addMonths, monthFromKey, monthKey, parseISODate, toISODate, weekStart } from './dates'
import { pct, sum } from './format'
import type { Expense, Supplier, SupplierPurchase, WorkItem, Worker } from './types'

const EPS = 0.0005

// ---------------------------------------------------------------------------
// Supplier debt
// ---------------------------------------------------------------------------
export type MonthStatus = 'paid' | 'upcoming' | 'due_soon' | 'due' | 'late'

export type SupplierMonth = {
  key: string // YYYY-MM
  paid: number
  status: MonthStatus
  windowStart: Date
  windowEnd: Date
}

export type SupplierStats = {
  owed: number
  paid: number
  remaining: number
  progress: number
  monthsLeft: number | null
  payoff: Date | null
  current: SupplierMonth
  months: SupplierMonth[] // newest first, from start month to this month
  payments: Expense[]
  purchases: SupplierPurchase[]
}

export function supplierPayments(expenses: Expense[], supplierId: string) {
  return expenses.filter((e) => e.kind === 'supplier_payment' && e.supplier_id === supplierId)
}

function paymentMonth(e: Expense) {
  return e.period || e.date.slice(0, 7)
}

export function monthsLeftFor(remaining: number, monthly: number, annualRate: number): number | null {
  if (remaining <= EPS) return 0
  if (!monthly || monthly <= 0) return null
  const r = (annualRate || 0) / 100 / 12
  if (r <= 0) return Math.ceil(remaining / monthly - EPS)
  if (monthly <= r * remaining) return null // payment does not cover the interest
  return Math.ceil(-Math.log(1 - (r * remaining) / monthly) / Math.log(1 + r) - EPS)
}

export function supplierStats(
  s: Supplier,
  allExpenses: Expense[],
  allPurchases: SupplierPurchase[],
  now = new Date(),
): SupplierStats {
  const payments = supplierPayments(allExpenses, s.id).sort((a, b) => b.date.localeCompare(a.date))
  const purchases = allPurchases.filter((p) => p.supplier_id === s.id).sort((a, b) => b.date.localeCompare(a.date))
  const owed = (Number(s.total_debt) || 0) + sum(purchases, (p) => p.amount)
  const paid = sum(payments, (p) => p.amount)
  const remaining = Math.max(0, owed - paid)
  const monthly = Number(s.monthly_payment) || 0
  const monthsLeft = monthsLeftFor(remaining, monthly, Number(s.interest_rate) || 0)

  const byMonth = new Map<string, number>()
  for (const p of payments) byMonth.set(paymentMonth(p), (byMonth.get(paymentMonth(p)) || 0) + Number(p.amount))

  const thisKey = monthKey(now)
  const statusOf = (key: string): SupplierMonth => {
    const m = monthFromKey(key)
    const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
    const ws = new Date(m.getFullYear(), m.getMonth(), Math.min(s.window_start_day || 22, lastDay))
    const we = new Date(m.getFullYear(), m.getMonth(), Math.min(s.window_end_day || 25, lastDay), 23, 59, 59)
    const paidAmt = byMonth.get(key) || 0
    let status: MonthStatus
    if ((monthly > 0 && paidAmt >= monthly - EPS) || (paidAmt > 0 && remaining <= EPS)) status = 'paid'
    else if (key < thisKey) status = 'late'
    else if (key > thisKey) status = 'upcoming'
    else {
      const day = now.getDate()
      if (now > we) status = 'late'
      else if (day >= ws.getDate()) status = 'due'
      else if (day >= ws.getDate() - 3) status = 'due_soon'
      else status = 'upcoming'
    }
    return { key, paid: paidAmt, status, windowStart: ws, windowEnd: we }
  }

  const startKey = s.start_month || (s.created_at ? s.created_at.slice(0, 7) : thisKey)
  const months: SupplierMonth[] = []
  for (let d = monthFromKey(thisKey); monthKey(d) >= startKey && months.length < 120; d = addMonths(d, -1)) {
    months.push(statusOf(monthKey(d)))
  }
  if (!months.length) months.push(statusOf(thisKey))
  const current = months[0].key === thisKey ? months[0] : statusOf(thisKey)

  return {
    owed,
    paid,
    remaining,
    progress: pct(paid, owed),
    monthsLeft,
    payoff: monthsLeft != null && monthsLeft > 0 ? addMonths(now, monthsLeft - (current.status === 'paid' ? 0 : 1)) : null,
    current,
    months,
    payments,
    purchases,
  }
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------
export type WorkerStats = {
  paid: number
  remaining: number
  progress: number
  weeksLeft: number | null
  weekKey: string
  paidThisWeek: number
  dueThisWeek: boolean
  payments: Expense[]
}

export function currentWeekKey(payday: number, now = new Date()) {
  return toISODate(weekStart(now, payday))
}

export function workerStats(w: Worker, allExpenses: Expense[], payday: number, now = new Date()): WorkerStats {
  const payments = allExpenses
    .filter((e) => e.kind === 'worker_payment' && e.worker_id === w.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const paid = sum(payments, (p) => p.amount)
  const agreed = Number(w.agreed_total) || 0
  const remaining = Math.max(0, agreed - paid)
  const weekly = Number(w.weekly_payment) || 0
  const weekKey = currentWeekKey(payday, now)
  const paidThisWeek = sum(
    payments.filter((p) => (p.period || toISODate(weekStart(parseISODate(p.date), payday))) === weekKey),
    (p) => p.amount,
  )
  const started = !w.start_date || w.start_date <= toISODate(now)
  return {
    paid,
    remaining,
    progress: pct(paid, agreed),
    weeksLeft: remaining <= EPS ? 0 : weekly > 0 ? Math.ceil(remaining / weekly - EPS) : null,
    weekKey,
    paidThisWeek,
    dueThisWeek: w.active && started && remaining > EPS && paidThisWeek <= EPS && weekly > 0,
    payments,
  }
}

// ---------------------------------------------------------------------------
// Work
// ---------------------------------------------------------------------------
export function workProgress(items: WorkItem[]) {
  const total = sum(items, (i) => i.estimated_cost)
  const done = items.filter((i) => i.status === 'done')
  const remainingCost = sum(items.filter((i) => i.status !== 'done'), (i) => i.estimated_cost)
  // Weighted by estimated cost when costs are entered, otherwise by task count.
  const progress = total > 0 ? pct(total - remainingCost, total) : pct(done.length, items.length)
  return { total, remainingCost, progress, doneCount: done.length, count: items.length }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function monthlyTotals(expenses: Expense[], months = 6, now = new Date()) {
  const out: { key: string; date: Date; total: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = addMonths(now, -i)
    out.push({ key: monthKey(d), date: d, total: 0 })
  }
  const idx = new Map(out.map((m, i) => [m.key, i]))
  for (const e of expenses) {
    const i = idx.get(e.date.slice(0, 7))
    if (i != null) out[i].total += Number(e.amount) || 0
  }
  return out
}
