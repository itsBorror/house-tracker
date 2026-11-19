import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { AmountInput, PhotoButton, PhotoImg, Sheet, toast, useCloseSheet } from '../components/ui'
import { save, saveSettings, useRows, useSettings } from '../lib/store'
import { parseAmount } from '../lib/format'
import { today } from '../lib/dates'
import { addPhoto, deletePhoto } from '../lib/photos'
import type { Expense } from '../lib/types'

const LAST_CAT = 'ht:lastCategory'

export type ExpensePreset = Partial<Expense>

/** Add or edit an expense. Pass `expense` to edit, `preset` to prefill a new one. */
export function ExpenseSheet({ expense, preset, title, onSaved }: { expense?: Expense; preset?: ExpensePreset; title?: string; onSaved?: (e: Expense) => void }) {
  const close = useCloseSheet()
  const { categories } = useSettings()
  const areas = useRows('areas').sort((a, b) => a.sort - b.sort)
  const photos = useRows('photos')
  const base = expense || preset || {}
  const [amount, setAmount] = useState(base.amount != null && base.amount !== 0 ? String(base.amount) : '')
  const [category, setCategory] = useState(base.category || localStorage.getItem(LAST_CAT) || categories[0])
  const [date, setDate] = useState(base.date || today())
  const [areaId, setAreaId] = useState(base.area_id || '')
  const [paidTo, setPaidTo] = useState(base.paid_to || '')
  const [note, setNote] = useState(base.note || '')
  const [newCat, setNewCat] = useState<string | null>(null)
  const [pending, setPending] = useState<File[]>([])
  const receipts = expense ? photos.filter((p) => p.kind === 'receipt' && p.ref_id === expense.id) : []
  const value = parseAmount(amount)
  const kind = expense?.kind || preset?.kind || 'expense'

  const submit = async () => {
    if (value == null || value <= 0) return
    const row = save('expenses', {
      ...(preset || {}),
      ...(expense ? { id: expense.id } : {}),
      kind,
      amount: value,
      category,
      date,
      area_id: areaId || null,
      paid_to: paidTo.trim() || null,
      note: note.trim() || null,
    })
    localStorage.setItem(LAST_CAT, category)
    for (const f of pending) await addPhoto(f, { kind: 'receipt', ref_id: row.id, area_id: row.area_id, date: row.date })
    toast(expense ? 'Expense updated' : 'Expense added')
    onSaved?.(row)
    close()
  }

  const addCategory = () => {
    const c = (newCat || '').trim()
    if (c && !categories.includes(c)) saveSettings({ categories: [...categories, c] })
    if (c) setCategory(c)
    setNewCat(null)
  }

  return (
    <Sheet title={title || (expense ? 'Edit expense' : 'New expense')} onDone={submit} doneLabel={expense ? 'Save' : 'Add'} doneDisabled={!value}>
      <AmountInput value={amount} onChange={setAmount} autoFocus={!expense} />

      {kind === 'expense' && (
        <>
          <div className="pickgrid" style={{ marginBottom: 16 }}>
            {categories.map((c) => (
              <button key={c} className={`chip press ${c === category ? 'on' : ''}`} onClick={() => setCategory(c)} type="button">
                {c}
              </button>
            ))}
            {newCat == null ? (
              <button className="chip press" onClick={() => setNewCat('')} type="button" aria-label="Add category">
                <Plus size={16} /> New
              </button>
            ) : (
              <span className="chip" style={{ paddingRight: 4 }}>
                <input
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  onBlur={addCategory}
                  placeholder="Category"
                  style={{ border: 0, outline: 'none', background: 'transparent', width: 110, fontSize: 15 }}
                />
              </span>
            )}
          </div>
        </>
      )}

      <div className="field-list">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        </div>
        <div className="field">
          <label>Area</label>
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">None</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {kind === 'expense' && (
          <div className="field">
            <label>Paid to</label>
            <input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="Shop or person" />
          </div>
        )}
        <div className="field stack">
          <label>Notes</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" rows={2} style={{ minHeight: 48 }} />
        </div>
      </div>

      <div className="list-header">Receipt</div>
      {(receipts.length > 0 || pending.length > 0) && (
        <div className="photo-grid" style={{ marginBottom: 10 }}>
          {receipts.map((p) => (
            <div className="ph" key={p.id}>
              <PhotoImg photo={p} />
              <button className="ph-x" onClick={() => deletePhoto(p)} aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          ))}
          {pending.map((f, i) => (
            <div className="ph" key={i}>
              <img src={URL.createObjectURL(f)} className="thumb-img" alt="" />
              <button className="ph-x" onClick={() => setPending(pending.filter((_, j) => j !== i))} aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <PhotoButton onFile={(f) => setPending([...pending, f])} label="Add receipt photo" />
    </Sheet>
  )
}
