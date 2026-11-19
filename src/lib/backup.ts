import { getState, save } from './store'
import { TABLES, type TableName } from './types'
import { dt } from './format'

function live<T extends { deleted?: boolean }>(m: Record<string, T>) {
  return Object.values(m).filter((r) => !r.deleted)
}

export function exportJSON(): Blob {
  const { data } = getState()
  const out: Record<string, unknown> = { app: 'house-tracker', version: 1, exported_at: new Date().toISOString() }
  for (const t of TABLES) out[t] = live(data[t] as Record<string, { deleted?: boolean }>)
  return new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
}

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportExpensesCSV(): Blob {
  const { data } = getState()
  const areas = data.areas
  const rows = live(data.expenses).sort((a, b) => a.date.localeCompare(b.date))
  const head = ['Date', 'Amount (DT)', 'Category', 'Area', 'Paid to', 'Type', 'Notes']
  const kind = { expense: 'Expense', supplier_payment: 'Supplier payment', worker_payment: 'Worker payment' }
  const lines = rows.map((e) =>
    [e.date, Number(e.amount).toFixed(3), e.category, e.area_id ? areas[e.area_id]?.name : '', e.paid_to, kind[e.kind] || e.kind, e.note]
      .map(esc)
      .join(','),
  )
  return new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv' })
}

/** Share (iPhone share sheet: Save to Files, AirDrop, WhatsApp...) or download. */
export async function shareFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Restore from a JSON backup. Rows are merged in (same id = replaced). */
export async function restoreJSON(file: File): Promise<number> {
  const json = JSON.parse(await file.text())
  if (json.app !== 'house-tracker') throw new Error('This is not a House Tracker backup file.')
  const { householdId } = getState()
  let n = 0
  for (const t of TABLES as TableName[]) {
    const rows = Array.isArray(json[t]) ? json[t] : []
    for (const r of rows) {
      if (t === 'settings') save('settings', { ...r, id: householdId! })
      else save(t, r)
      n++
    }
  }
  return n
}

export function summaryLine(paid: number, total: number) {
  return `You've paid ${dt(paid, { short: true })} of ${dt(total, { short: true })}`
}
