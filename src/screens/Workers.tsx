import { useMemo, useState } from 'react'
import { CheckCircle2, HardHat, Phone, Plus } from 'lucide-react'
import {
  AmountInput,
  Empty,
  Hint,
  Page,
  Pill,
  Progress,
  Sheet,
  primeKeyboard,
  toast,
  useCloseSheet,
  useConfirmDelete,
  useNav,
} from '../components/ui'
import { ExpenseRow } from '../components/ExpenseRow'
import { remove, save, useRows, useSettings } from '../lib/store'
import { currentWeekKey, workerStats } from '../lib/calc'
import { dt, parseAmount } from '../lib/format'
import { WEEKDAYS, addDays, fmtDate, parseISODate, today } from '../lib/dates'
import type { Worker } from '../lib/types'

function useWorkerStats(w: Worker) {
  const expenses = useRows('expenses')
  const { worker_payday } = useSettings()
  return useMemo(() => workerStats(w, expenses, worker_payday), [w, expenses, worker_payday])
}

function weekLabel(key: string) {
  const s = parseISODate(key)
  return `${fmtDate(s)} – ${fmtDate(addDays(s, 6))}`
}

function weeksText(n: number | null) {
  if (n == null) return 'Set a weekly payment to see weeks left'
  if (n === 0) return 'Fully paid'
  return `About ${n} week${n === 1 ? '' : 's'} left`
}

export function Workers() {
  const nav = useNav()
  const { worker_payday } = useSettings()
  const workers = useRows('workers').sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const add = () => nav.openSheet(() => <WorkerSheet />)
  return (
    <Page
      title="Workers"
      right={
        workers.length > 0 && (
          <button className="nav-btn" onClick={add} aria-label="Add worker">
            <Plus size={26} />
          </button>
        )
      }
    >
      {workers.length === 0 ? (
        <>
          <Empty icon={<HardHat size={30} />} text="Add the people working on your house and the price you agreed with them." action="Add worker" onAction={add} />
          <Hint>Weekly payments are due every {WEEKDAYS[worker_payday]}. You can change the day in Settings.</Hint>
        </>
      ) : (
        workers.map((w) => <WorkerCard key={w.id} w={w} />)
      )}
    </Page>
  )
}

function WorkerCard({ w }: { w: Worker }) {
  const nav = useNav()
  const st = useWorkerStats(w)
  const paidWeek = st.paidThisWeek > 0
  return (
    <div className="card" style={{ marginBottom: 12, opacity: w.active ? 1 : 0.6 }}>
      <button className="press" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => nav.push(<WorkerDetail id={w.id} />)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{w.name}</div>
            <div className="caption">{[w.trade, w.active ? null : 'Finished'].filter(Boolean).join(' · ') || 'Worker'}</div>
          </div>
          {w.active && st.remaining > 0 && (paidWeek ? <Pill color="green">Paid this week</Pill> : <Pill color="orange">Due this week</Pill>)}
          {st.remaining <= 0 && Number(w.agreed_total) > 0 && <Pill color="green">Fully paid</Pill>}
        </div>
        <div style={{ margin: '14px 0 8px' }}>
          <Progress value={st.progress} color="var(--green)" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
          <span>
            Paid <b className="num">{dt(st.paid, { short: true })}</b>
          </span>
          <span className="muted num">{dt(st.remaining, { short: true })} left</span>
        </div>
        <div className="caption" style={{ marginTop: 2 }}>
          {weeksText(st.weeksLeft)} · {dt(w.weekly_payment, { short: true })}/week
        </div>
      </button>
      {st.dueThisWeek && (
        <button
          className="btn green"
          style={{ marginTop: 12 }}
          onClick={() => {
            primeKeyboard()
            nav.openSheet(() => <PayWorkerSheet worker={w} />)
          }}
        >
          <CheckCircle2 size={20} /> Pay {dt(w.weekly_payment, { short: true })}
        </button>
      )}
    </div>
  )
}

function WorkerDetail({ id }: { id: string }) {
  const w = useRows('workers').find((x) => x.id === id)
  if (!w) return <Page title="Worker" back="Workers" children={null} />
  return <WorkerDetailInner w={w} />
}

function WorkerDetailInner({ w }: { w: Worker }) {
  const nav = useNav()
  const confirmDelete = useConfirmDelete()
  const st = useWorkerStats(w)
  const areas = useRows('areas')
  const area = areas.find((a) => a.id === w.area_id)
  return (
    <Page
      title={w.name}
      back="Workers"
      sub={[w.trade, area?.name].filter(Boolean).join(' · ') || undefined}
      right={
        <button className="nav-btn" onClick={() => nav.openSheet(() => <WorkerSheet worker={w} />)}>
          Edit
        </button>
      }
    >
      <div className="card">
        <div className="caption">Remaining balance</div>
        <div className="num" style={{ fontSize: 34, fontWeight: 700 }}>
          {dt(st.remaining)}
        </div>
        <div style={{ margin: '12px 0 8px' }}>
          <Progress value={st.progress} color="var(--green)" />
        </div>
        <div style={{ fontSize: 15 }}>
          You've paid <b className="num">{dt(st.paid, { short: true })}</b> of {dt(w.agreed_total, { short: true })}
        </div>
        <div className="caption">
          {weeksText(st.weeksLeft)}
          {w.start_date ? ` · started ${fmtDate(w.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>This week</div>
            <div className="caption">{weekLabel(st.weekKey)}</div>
          </div>
          {st.paidThisWeek > 0 ? <Pill color="green">Paid {dt(st.paidThisWeek, { short: true })}</Pill> : <Pill color={st.remaining > 0 ? 'orange' : 'gray'}>Not paid</Pill>}
        </div>
        {st.remaining > 0 && (
          <button
            className="btn green"
            style={{ marginTop: 12 }}
            onClick={() => {
              primeKeyboard()
              nav.openSheet(() => <PayWorkerSheet worker={w} />)
            }}
          >
            <CheckCircle2 size={20} /> Log payment
          </button>
        )}
      </div>

      {w.phone && (
        <a className="btn secondary" style={{ marginTop: 12, textDecoration: 'none' }} href={`tel:${w.phone.replace(/\s/g, '')}`}>
          <Phone size={18} /> Call {w.phone}
        </a>
      )}

      <div className="section-title">Payment history</div>
      {st.payments.length ? (
        <div className="list">
          {st.payments.map((p) => (
            <ExpenseRow key={p.id} e={p} />
          ))}
        </div>
      ) : (
        <div className="card caption">No payments yet. Each payment is also added to Expenses as Labor.</div>
      )}

      <div className="spacer" />
      <button
        className="btn danger"
        onClick={() =>
          confirmDelete('worker', () => {
            remove('workers', w.id)
            nav.pop()
          })
        }
      >
        Delete worker
      </button>
    </Page>
  )
}

export function PayWorkerSheet({ worker }: { worker: Worker }) {
  const close = useCloseSheet()
  const { worker_payday } = useSettings()
  const [amount, setAmount] = useState(worker.weekly_payment ? String(worker.weekly_payment) : '')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const value = parseAmount(amount)
  const submit = () => {
    if (!value) return
    save('expenses', {
      kind: 'worker_payment',
      worker_id: worker.id,
      period: currentWeekKey(worker_payday, parseISODate(date)),
      amount: value,
      date,
      category: 'Labor',
      paid_to: worker.name,
      area_id: worker.area_id,
      note: note.trim() || null,
      supplier_id: null,
      work_item_id: null,
    })
    toast(`${worker.name} marked as paid`)
    close()
  }
  return (
    <Sheet title={`Pay ${worker.name}`} onDone={submit} doneLabel="Paid" doneDisabled={!value}>
      <AmountInput value={amount} onChange={setAmount} />
      <div className="field-list">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        </div>
        <div className="field">
          <label>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <button className="btn green" style={{ marginTop: 16 }} onClick={submit} disabled={!value}>
        <CheckCircle2 size={20} /> Mark as paid
      </button>
      <Hint>This is also added to Expenses as Labor, so you don't enter it twice.</Hint>
    </Sheet>
  )
}

function WorkerSheet({ worker }: { worker?: Worker }) {
  const close = useCloseSheet()
  const areas = useRows('areas').sort((a, b) => a.sort - b.sort)
  const [name, setName] = useState(worker?.name || '')
  const [trade, setTrade] = useState(worker?.trade || '')
  const [agreed, setAgreed] = useState(worker ? String(worker.agreed_total) : '')
  const [weekly, setWeekly] = useState(worker ? String(worker.weekly_payment) : '')
  const [start, setStart] = useState(worker?.start_date || today())
  const [areaId, setAreaId] = useState(worker?.area_id || '')
  const [phone, setPhone] = useState(worker?.phone || '')
  const [active, setActive] = useState(worker?.active ?? true)
  const a = parseAmount(agreed)
  const w = parseAmount(weekly)
  const ok = name.trim() && a != null && w != null

  const submit = () => {
    if (!ok) return
    save('workers', {
      id: worker?.id,
      name: name.trim(),
      trade: trade.trim() || null,
      agreed_total: a!,
      weekly_payment: w!,
      start_date: start || null,
      area_id: areaId || null,
      phone: phone.trim() || null,
      active,
      note: worker?.note ?? null,
    })
    toast(worker ? 'Worker updated' : 'Worker added')
    close()
  }

  return (
    <Sheet title={worker ? 'Edit worker' : 'New worker'} onDone={submit} doneDisabled={!ok}>
      <div className="field-list">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus={!worker} />
        </div>
        <div className="field">
          <label>Trade</label>
          <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Mason, Electrician" />
        </div>
      </div>
      <div className="list-header">Price</div>
      <div className="field-list">
        <div className="field">
          <label>Agreed total</label>
          <input inputMode="decimal" value={agreed} onChange={(e) => setAgreed(e.target.value)} placeholder="0.000 DT" />
        </div>
        <div className="field">
          <label>Weekly payment</label>
          <input inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="0.000 DT" />
        </div>
      </div>
      <div className="list-header">Details</div>
      <div className="field-list">
        <div className="field">
          <label>Start date</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>Area</label>
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Whole house</option>
            {areas.map((ar) => (
              <option key={ar.id} value={ar.id}>
                {ar.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>
        <div className="field">
          <label>Still working</label>
          <Switch on={active} onChange={setActive} />
        </div>
      </div>
      <p className="footnote">The agreed total is fixed before they start. Weeks left = remaining balance ÷ weekly payment.</p>
    </Sheet>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} style={{ marginLeft: 'auto' }}>
      <span />
    </button>
  )
}
