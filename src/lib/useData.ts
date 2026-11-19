import { useMemo } from 'react'
import { useRows, useSettings } from './store'
import { monthlyTotals, supplierStats, workProgress, workerStats } from './calc'
import { sum } from './format'

/** Every number on the dashboard, derived live from the data. */
export function useDashboard() {
  const expenses = useRows('expenses')
  const suppliers = useRows('suppliers')
  const purchases = useRows('supplier_purchases')
  const items = useRows('work_items')
  const workers = useRows('workers')
  const { worker_payday } = useSettings()

  return useMemo(() => {
    const spent = sum(expenses, (e) => e.amount)
    const sup = suppliers.map((s) => ({ supplier: s, stats: supplierStats(s, expenses, purchases) }))
    const debtLeft = sum(sup, (x) => x.stats.remaining)
    const work = workProgress(items)
    const wk = workers.map((w) => ({ worker: w, stats: workerStats(w, expenses, worker_payday) }))
    const workersLeft = sum(wk.filter((x) => x.worker.active), (x) => x.stats.remaining)
    return {
      spent,
      debtLeft,
      workLeft: work.remainingCost,
      needed: work.remainingCost + debtLeft,
      finished: work.progress,
      work,
      suppliers: sup,
      workers: wk,
      workersLeft,
      monthly: monthlyTotals(expenses, 6),
      dueSuppliers: sup.filter((x) => x.stats.remaining > 0 && ['due_soon', 'due', 'late'].includes(x.stats.current.status)),
      dueWorkers: wk.filter((x) => x.stats.dueThisWeek),
      hasAnyData: expenses.length + suppliers.length + items.length + workers.length > 0,
    }
  }, [expenses, suppliers, purchases, items, workers, worker_payday])
}
