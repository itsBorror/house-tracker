import { BrickWall, DoorOpen, Droplets, Grid3x3, HardHat, PaintRoller, Tag, Wallet, Zap } from 'lucide-react'
import { PhotoImg, PhotoViewer, Row, Sheet, SwipeRow, primeKeyboard, toast, useCloseSheet, useConfirmDelete, useNav } from './ui'
import { ExpenseSheet } from '../screens/ExpenseSheet'
import { remove, useRows } from '../lib/store'
import { dt } from '../lib/format'
import { fmtDate, relativeDay, today } from '../lib/dates'
import { deletePhoto } from '../lib/photos'
import type { Expense, Photo } from '../lib/types'
import { useState } from 'react'

const CAT_STYLE: Record<string, { icon: typeof Tag; color: string }> = {
  Labor: { icon: HardHat, color: '#FF9500' },
  'Cement & Materials': { icon: BrickWall, color: '#A2845E' },
  Electrical: { icon: Zap, color: '#FFCC00' },
  Plumbing: { icon: Droplets, color: '#32ADE6' },
  Tiles: { icon: Grid3x3, color: '#5856D6' },
  'Windows & Doors': { icon: DoorOpen, color: '#30B0C7' },
  Painting: { icon: PaintRoller, color: '#FF2D55' },
}

export function categoryStyle(cat: string, kind?: Expense['kind']) {
  if (kind === 'supplier_payment') return { icon: Wallet, color: '#007AFF' }
  if (kind === 'worker_payment') return CAT_STYLE.Labor
  return CAT_STYLE[cat] || { icon: Tag, color: '#8E8E93' }
}

export function CategoryIcon({ cat, kind, size = 17 }: { cat: string; kind?: Expense['kind']; size?: number }) {
  const s = categoryStyle(cat, kind)
  return <s.icon size={size} strokeWidth={2} />
}

export function expenseTitle(e: Expense, names: { suppliers: Record<string, string>; workers: Record<string, string> }) {
  if (e.kind === 'supplier_payment') return `Payment · ${names.suppliers[e.supplier_id || ''] || 'Supplier'}`
  if (e.kind === 'worker_payment') return `Weekly pay · ${names.workers[e.worker_id || ''] || 'Worker'}`
  return e.paid_to || e.note || e.category
}

export function useNames() {
  const suppliers = useRows('suppliers')
  const workers = useRows('workers')
  const areas = useRows('areas')
  return {
    suppliers: Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    workers: Object.fromEntries(workers.map((w) => [w.id, w.name])),
    areas: Object.fromEntries(areas.map((a) => [a.id, a.name])),
  }
}

export function ExpenseRow({ e, showDate = true }: { e: Expense; showDate?: boolean }) {
  const nav = useNav()
  const names = useNames()
  const confirmDelete = useConfirmDelete()
  const s = categoryStyle(e.category, e.kind)
  const title = expenseTitle(e, names)
  const sub = [showDate ? relativeDay(e.date) : null, e.kind === 'expense' && title !== e.category ? e.category : null, e.area_id ? names.areas[e.area_id] : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <SwipeRow
      onEdit={() => nav.openSheet(() => <ExpenseSheet expense={e} />)}
      onDelete={() => confirmDelete('expense', () => deleteExpense(e))}
    >
      <Row
        icon={<CategoryIcon cat={e.category} kind={e.kind} />}
        iconBg={s.color}
        title={title}
        sub={sub || undefined}
        value={dt(e.amount)}
        strong
        chevron={false}
        onClick={() => nav.openSheet(() => <ExpenseDetail id={e.id} />)}
      />
    </SwipeRow>
  )
}

export function deleteExpense(e: Expense) {
  remove('expenses', e.id)
  toast('Expense deleted')
}

function ExpenseDetail({ id }: { id: string }) {
  const nav = useNav()
  const close = useCloseSheet()
  const names = useNames()
  const confirmDelete = useConfirmDelete()
  const e = useRows('expenses').find((x) => x.id === id)
  const photos = useRows('photos').filter((p) => p.kind === 'receipt' && p.ref_id === id)
  const [view, setView] = useState<Photo | null>(null)
  if (!e) return null
  const kindLabel = e.kind === 'supplier_payment' ? 'Supplier payment' : e.kind === 'worker_payment' ? 'Worker payment' : 'Expense'
  return (
    <Sheet title={kindLabel} cancelLabel="Close">
      <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
        <div className="num" style={{ fontSize: 40, fontWeight: 700 }}>
          {dt(e.amount)}
        </div>
        <div className="caption" style={{ marginTop: 4 }}>
          {fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div className="list">
        <Row title="Title" value={expenseTitle(e, names)} />
        <Row title="Category" value={e.category} />
        {e.area_id && <Row title="Area" value={names.areas[e.area_id]} />}
        {e.paid_to && e.kind === 'expense' && <Row title="Paid to" value={e.paid_to} />}
        {e.note && <Row title="Notes" sub={e.note} />}
      </div>
      {photos.length > 0 && (
        <>
          <div className="list-header">Receipt</div>
          <div className="photo-grid">
            {photos.map((p) => (
              <button className="ph" key={p.id} onClick={() => setView(p)}>
                <PhotoImg photo={p} />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="btn-row">
        <button
          className="btn secondary"
          onClick={() => {
            close()
            nav.openSheet(() => <ExpenseSheet expense={e} />)
          }}
        >
          Edit
        </button>
        {e.kind === 'expense' && (
          <button
            className="btn secondary"
            onClick={() => {
              close()
              primeKeyboard()
              const { id: _id, created_at: _c, updated_at: _u, created_by: _b, ...rest } = e
              nav.openSheet(() => <ExpenseSheet preset={{ ...rest, date: today() }} title="Duplicate expense" />)
            }}
          >
            Duplicate
          </button>
        )}
      </div>
      <button className="btn danger" style={{ marginTop: 8 }} onClick={() => confirmDelete('expense', () => (deleteExpense(e), close()))}>
        Delete expense
      </button>
      {view && <PhotoViewer photo={view} onClose={() => setView(null)} onDelete={() => (deletePhoto(view), setView(null))} />}
    </Sheet>
  )
}
