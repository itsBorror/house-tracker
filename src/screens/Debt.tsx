import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Plus, ShoppingCart, Wallet } from 'lucide-react'
import {
  AmountInput,
  Empty,
  Hint,
  Page,
  Pill,
  Progress,
  Row,
  Sheet,
  SwipeRow,
  primeKeyboard,
  toast,
  useCloseSheet,
  useConfirmDelete,
  useNav,
} from '../components/ui'
import { ExpenseRow } from '../components/ExpenseRow'
import { remove, save, useRows } from '../lib/store'
import { supplierStats, type MonthStatus, type SupplierMonth } from '../lib/calc'
import { dt, parseAmount } from '../lib/format'
import { fmtDate, fmtMonth, monthFromKey, monthKey, today } from '../lib/dates'
import type { Supplier, SupplierPurchase } from '../lib/types'

export const SUPPLIER_CATEGORY = 'Supplier payment'

const STATUS: Record<MonthStatus, { label: string; color: 'green' | 'orange' | 'red' | 'gray' }> = {
  paid: { label: 'Paid', color: 'green' },
  upcoming: { label: 'Upcoming', color: 'gray' },
  due_soon: { label: 'Due soon', color: 'orange' },
  due: { label: 'Due now', color: 'orange' },
  late: { label: 'Late', color: 'red' },
}

export function MonthPill({ status }: { status: MonthStatus }) {
  const s = STATUS[status]
  return <Pill color={s.color}>{s.label}</Pill>
}

function useSupplierStats(s: Supplier) {
  const expenses = useRows('expenses')
  const purchases = useRows('supplier_purchases')
  return useMemo(() => supplierStats(s, expenses, purchases), [s, expenses, purchases])
}

function monthsLeftText(n: number | null) {
  if (n == null) return 'Set a monthly payment to see months left'
  if (n === 0) return 'Fully paid'
  return `About ${n} month${n === 1 ? '' : 's'} left`
}

function windowText(m: SupplierMonth) {
  return `${fmtDate(m.windowStart)} – ${fmtDate(m.windowEnd)}`
}

export function Debt() {
  const nav = useNav()
  const suppliers = useRows('suppliers').sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  const setup = () => nav.openSheet(() => <SupplierSetupSheet />)
  return (
    <Page
      title="Debt"
      right={
        suppliers.length > 0 && (
          <button className="nav-btn" onClick={setup} aria-label="Add supplier">
            <Plus size={26} />
          </button>
        )
      }
    >
      {suppliers.length === 0 ? (
        <>
          <Empty icon={<Wallet size={30} />} text="Set up your supplier to track what you owe and your monthly payments." action="Set up supplier" onAction={setup} />
          <Hint>You'll enter the total you owe and your monthly payment. The app reminds you from the 22nd to the 25th each month.</Hint>
        </>
      ) : (
        suppliers.map((s) => <SupplierCard key={s.id} s={s} />)
      )}
    </Page>
  )
}

function SupplierCard({ s }: { s: Supplier }) {
  const nav = useNav()
  const st = useSupplierStats(s)
  const paidThisMonth = st.current.status === 'paid'
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <button style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => nav.push(<SupplierDetail id={s.id} />)} className="press">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{s.name}</div>
          <span className="caption" style={{ color: 'var(--blue)' }}>
            Details ›
          </span>
        </div>
        <div className="caption" style={{ marginTop: 14 }}>
          Remaining
        </div>
        <div className="num" style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>
          {dt(st.remaining)}
        </div>
        <div style={{ margin: '12px 0 8px' }}>
          <Progress value={st.progress} color="var(--green)" />
        </div>
        <div style={{ fontSize: 15 }}>
          You've paid <b className="num">{dt(st.paid, { short: true })}</b> of <span className="num">{dt(st.owed, { short: true })}</span>
        </div>
        <div className="caption" style={{ marginTop: 2 }}>
          {monthsLeftText(st.monthsLeft)}
          {st.payoff ? ` · done around ${fmtMonth(st.payoff)}` : ''}
        </div>
      </button>
      {st.remaining > 0 && (
        <div className="card" style={{ background: 'var(--fill-2)', boxShadow: 'none', marginTop: 16, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{fmtMonth(monthFromKey(st.current.key))}</div>
              <div className="caption">
                {dt(s.monthly_payment)} · {windowText(st.current)}
              </div>
            </div>
            <MonthPill status={st.current.status} />
          </div>
          {!paidThisMonth && (
            <button
              className="btn green"
              style={{ marginTop: 12 }}
              onClick={() => {
                primeKeyboard()
                nav.openSheet(() => <PaySupplierSheet supplier={s} monthKey={st.current.key} />)
              }}
            >
              <CheckCircle2 size={20} /> Mark as paid
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SupplierDetail({ id }: { id: string }) {
  const nav = useNav()
  const confirmDelete = useConfirmDelete()
  const s = useRows('suppliers').find((x) => x.id === id)
  if (!s) return <Page title="Supplier" back="Debt" children={null} />
  return <SupplierDetailInner s={s} nav={nav} confirmDelete={confirmDelete} />
}

function SupplierDetailInner({
  s,
  nav,
  confirmDelete,
}: {
  s: Supplier
  nav: ReturnType<typeof useNav>
  confirmDelete: ReturnType<typeof useConfirmDelete>
}) {
  const st = useSupplierStats(s)
  const pay = (key: string) => {
    primeKeyboard()
    nav.openSheet(() => <PaySupplierSheet supplier={s} monthKey={key} />)
  }
  return (
    <Page
      title={s.name}
      back="Debt"
      right={
        <button className="nav-btn" onClick={() => nav.openSheet(() => <SupplierSetupSheet supplier={s} />)}>
          Edit
        </button>
      }
    >
      <div className="grid2" style={{ marginTop: 0 }}>
        <MiniStat label="Total owed" value={dt(st.owed, { short: true })} />
        <MiniStat label="Total paid" value={dt(st.paid, { short: true })} color="var(--green)" />
        <MiniStat label="Remaining" value={dt(st.remaining, { short: true })} color="var(--orange)" />
        <MiniStat label="Months left" value={st.monthsLeft == null ? '–' : String(st.monthsLeft)} />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <Progress value={st.progress} color="var(--green)" />
        <div style={{ fontSize: 15, marginTop: 10 }}>
          You've paid {dt(st.paid, { short: true })} of {dt(st.owed, { short: true })} ({Math.round(st.progress)}%)
        </div>
        <div className="caption">
          {dt(s.monthly_payment)} per month · window day {s.window_start_day}–{s.window_end_day}
          {s.interest_rate ? ` · ${s.interest_rate}% interest/year` : ''}
        </div>
      </div>

      <div className="list-header">Months</div>
      <div className="list">
        {st.months.slice(0, 24).map((m) => (
          <Row
            key={m.key}
            title={fmtMonth(monthFromKey(m.key))}
            sub={m.paid > 0 ? `Paid ${dt(m.paid)}` : windowText(m)}
            value={
              m.status === 'paid' || st.remaining <= 0 ? (
                <MonthPill status="paid" />
              ) : (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <MonthPill status={m.status} />
                  <button className="btn small green" onClick={() => pay(m.key)}>
                    Pay
                  </button>
                </span>
              )
            }
          />
        ))}
      </div>

      <div className="section-title">Payment history</div>
      {st.payments.length ? (
        <div className="list">
          {st.payments.map((p) => (
            <ExpenseRow key={p.id} e={p} />
          ))}
        </div>
      ) : (
        <div className="card caption">No payments yet. Each payment you mark is also added to Expenses.</div>
      )}

      <div className="section-title">
        Purchases on credit
        <button className="link" onClick={() => (primeKeyboard(), nav.openSheet(() => <PurchaseSheet supplier={s} />))}>
          Add
        </button>
      </div>
      {st.purchases.length ? (
        <div className="list">
          {st.purchases.map((p) => (
            <SwipeRow
              key={p.id}
              onEdit={() => nav.openSheet(() => <PurchaseSheet supplier={s} purchase={p} />)}
              onDelete={() => confirmDelete('purchase', () => remove('supplier_purchases', p.id))}
            >
              <Row
                icon={<ShoppingCart size={16} />}
                iconBg="var(--indigo)"
                title={p.note || 'Purchase'}
                sub={fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                value={`+${dt(p.amount)}`}
                strong
              />
            </SwipeRow>
          ))}
        </div>
      ) : (
        <div className="card caption">Bought more on credit? Add it here and the debt goes up.</div>
      )}

      <div className="spacer" />
      <button
        className="btn danger"
        onClick={() =>
          confirmDelete('supplier', () => {
            remove('suppliers', s.id)
            nav.pop()
          })
        }
      >
        Delete supplier
      </button>
    </Page>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="stat" style={{ minHeight: 76 }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value num" style={{ fontSize: 20, color }}>
        {value}
      </span>
    </div>
  )
}

export function PaySupplierSheet({ supplier, monthKey: mk }: { supplier: Supplier; monthKey?: string }) {
  const close = useCloseSheet()
  const key = mk || monthKey(new Date())
  const [amount, setAmount] = useState(supplier.monthly_payment ? String(supplier.monthly_payment) : '')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const value = parseAmount(amount)
  const submit = () => {
    if (!value) return
    save('expenses', {
      kind: 'supplier_payment',
      supplier_id: supplier.id,
      period: key,
      amount: value,
      date,
      category: SUPPLIER_CATEGORY,
      paid_to: supplier.name,
      note: note.trim() || null,
      area_id: null,
      worker_id: null,
      work_item_id: null,
    })
    toast('Payment marked as paid')
    close()
  }
  return (
    <Sheet title={`Pay ${fmtMonth(monthFromKey(key))}`} onDone={submit} doneLabel="Paid" doneDisabled={!value}>
      <AmountInput value={amount} onChange={setAmount} />
      <div className="field-list">
        <div className="field">
          <label>Date paid</label>
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
      <Hint>This payment is also added to your expenses, so you don't need to enter it twice.</Hint>
    </Sheet>
  )
}

function PurchaseSheet({ supplier, purchase }: { supplier: Supplier; purchase?: SupplierPurchase }) {
  const close = useCloseSheet()
  const [amount, setAmount] = useState(purchase ? String(purchase.amount) : '')
  const [date, setDate] = useState(purchase?.date || today())
  const [note, setNote] = useState(purchase?.note || '')
  const value = parseAmount(amount)
  const submit = () => {
    if (!value) return
    save('supplier_purchases', { id: purchase?.id, supplier_id: supplier.id, amount: value, date, note: note.trim() || null })
    toast(purchase ? 'Purchase updated' : 'Debt increased')
    close()
  }
  return (
    <Sheet title={purchase ? 'Edit purchase' : 'New purchase'} onDone={submit} doneLabel="Save" doneDisabled={!value}>
      <AmountInput value={amount} onChange={setAmount} autoFocus={!purchase} />
      <div className="field-list">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        </div>
        <div className="field">
          <label>What</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 40 bags of cement" />
        </div>
      </div>
      <Hint>This adds to what you owe {supplier.name}. It is not an expense yet; your monthly payments are.</Hint>
    </Sheet>
  )
}

export function SupplierSetupSheet({ supplier }: { supplier?: Supplier }) {
  const close = useCloseSheet()
  const [name, setName] = useState(supplier?.name || '')
  const [total, setTotal] = useState(supplier ? String(supplier.total_debt) : '')
  const [monthly, setMonthly] = useState(supplier ? String(supplier.monthly_payment) : '')
  const [interest, setInterest] = useState(supplier?.interest_rate ? String(supplier.interest_rate) : '')
  const [startDay, setStartDay] = useState(String(supplier?.window_start_day ?? 22))
  const [endDay, setEndDay] = useState(String(supplier?.window_end_day ?? 25))
  const [startMonth, setStartMonth] = useState(supplier?.start_month || monthKey(new Date()))
  const t = parseAmount(total)
  const m = parseAmount(monthly)
  const sd = Math.min(28, Math.max(1, Number(startDay) || 22))
  const ed = Math.min(31, Math.max(sd, Number(endDay) || 25))
  const ok = name.trim() && t != null && m != null

  const submit = () => {
    if (!ok) return
    save('suppliers', {
      id: supplier?.id,
      name: name.trim(),
      total_debt: t!,
      monthly_payment: m!,
      interest_rate: parseAmount(interest) || 0,
      window_start_day: sd,
      window_end_day: ed,
      start_month: startMonth || null,
      note: supplier?.note ?? null,
    })
    toast(supplier ? 'Supplier updated' : 'Supplier added')
    close()
  }

  return (
    <Sheet title={supplier ? 'Edit supplier' : 'Set up supplier'} onDone={submit} doneDisabled={!ok}>
      <div className="field-list">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" autoFocus={!supplier} />
        </div>
        <div className="field">
          <label>Total owed</label>
          <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.000 DT" />
        </div>
        <div className="field">
          <label>Monthly payment</label>
          <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="0.000 DT" />
        </div>
        <div className="field">
          <label>Interest</label>
          <input inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="None (% per year)" />
        </div>
      </div>
      <div className="list-header">Payment window</div>
      <div className="field-list">
        <div className="field">
          <label>From day</label>
          <input inputMode="numeric" value={startDay} onChange={(e) => setStartDay(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <label>To day</label>
          <input inputMode="numeric" value={endDay} onChange={(e) => setEndDay(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <label>First payment</label>
          <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
        </div>
      </div>
      <p className="footnote">
        <CalendarClock size={13} style={{ verticalAlign: -2 }} /> You'll see a reminder on Home from day {sd} until you mark the month as paid.
        After day {ed} it shows as Late.
      </p>
    </Sheet>
  )
}
