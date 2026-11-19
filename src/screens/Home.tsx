import { AlertCircle, CalendarClock, CloudOff, FileText, Hammer, Images, Percent, Receipt, Settings as SettingsIcon, Wallet } from 'lucide-react'
import type { Tab } from '../App'
import { CountUp, Empty, Page, Progress, Row, Skeleton, primeKeyboard, useNav } from '../components/ui'
import { ExpenseRow } from '../components/ExpenseRow'
import { useDashboard } from '../lib/useData'
import { useRows, useStore } from '../lib/store'
import { dt, num } from '../lib/format'
import { fmtDate, fmtMonthShort } from '../lib/dates'
import { PaySupplierSheet } from './Debt'
import { PayWorkerSheet } from './Workers'
import { ExpenseSheet } from './ExpenseSheet'
import { Settings } from './Settings'
import { Documents } from './Documents'
import { Timeline } from './Timeline'

export function Home({ goTo }: { goTo: (t: Tab) => void }) {
  const nav = useNav()
  const store = useStore()
  const d = useDashboard()
  const expenses = useRows('expenses')
  const loading = !store.local && !store.lastSync && !d.hasAnyData && store.online

  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5)
  const maxMonth = Math.max(1, ...d.monthly.map((m) => m.total))

  return (
    <Page
      title="Home"
      right={
        <>
          {!store.online && (
            <span className="offline-dot">
              <CloudOff size={14} /> Offline
            </span>
          )}
          <button className="nav-btn" onClick={() => nav.push(<Settings />)} aria-label="Settings">
            <SettingsIcon size={23} />
          </button>
        </>
      }
    >
      {d.dueSuppliers.map(({ supplier, stats }) => {
        const late = stats.current.status === 'late'
        const color = late ? 'var(--red)' : 'var(--orange-fill)'
        return (
          <div className="banner" key={supplier.id}>
            <div className="b-icon" style={{ background: color }}>
              {late ? <AlertCircle size={20} /> : <CalendarClock size={20} />}
            </div>
            <div className="b-text">
              <b>{late ? `${supplier.name} payment is late` : `${supplier.name} payment ${stats.current.status === 'due' ? 'is due' : 'due soon'}`}</b>
              <span>
                {dt(supplier.monthly_payment)} · {fmtDate(stats.current.windowStart)} to {fmtDate(stats.current.windowEnd)}
              </span>
            </div>
            <button
              className="btn small"
              style={{ background: color }}
              onClick={() => {
                primeKeyboard()
                nav.openSheet(() => <PaySupplierSheet supplier={supplier} monthKey={stats.current.key} />)
              }}
            >
              Pay
            </button>
          </div>
        )
      })}
      {d.dueWorkers.map(({ worker }) => (
        <div className="banner" key={worker.id}>
          <div className="b-icon" style={{ background: 'var(--orange-fill)' }}>
            <CalendarClock size={20} />
          </div>
          <div className="b-text">
            <b>Pay {worker.name} this week</b>
            <span>{dt(worker.weekly_payment)} weekly payment</span>
          </div>
          <button
            className="btn small"
            style={{ background: 'var(--orange-fill)' }}
            onClick={() => {
              primeKeyboard()
              nav.openSheet(() => <PayWorkerSheet worker={worker} />)
            }}
          >
            Pay
          </button>
        </div>
      ))}

      <div className="card hero">
        <div className="hero-label">Money needed to finish</div>
        {loading ? (
          <Skeleton h={48} w="70%" style={{ margin: '8px 0' }} />
        ) : (
          <div className="hero-number">
            <CountUp value={d.needed} format={(n) => num(n, true)} />
            <small>DT</small>
          </div>
        )}
        <div className="caption">
          {d.needed > 0
            ? `${dt(d.workLeft, { short: true })} of work left + ${dt(d.debtLeft, { short: true })} of supplier debt`
            : d.hasAnyData
              ? 'Add tasks in Work and your supplier in Debt to see this.'
              : 'Start by adding your supplier, tasks and first expense.'}
        </div>
        <div style={{ marginTop: 14 }}>
          <Progress value={d.finished} color="var(--green)" />
        </div>
      </div>

      <div className="grid2">
        <Stat label="Spent" icon={<Receipt size={13} />} color="var(--blue)" value={d.spent} onClick={() => goTo('expenses')} loading={loading} />
        <Stat label="Debt left" icon={<Wallet size={13} />} color="var(--orange)" value={d.debtLeft} onClick={() => goTo('debt')} loading={loading} />
        <Stat label="Work left" icon={<Hammer size={13} />} color="var(--indigo)" value={d.workLeft} onClick={() => goTo('work')} loading={loading} />
        <button className="stat press" onClick={() => goTo('work')}>
          <span className="stat-label">
            <span className="icon-dot" style={{ background: 'var(--green)' }}>
              <Percent size={13} />
            </span>
            Finished
          </span>
          {loading ? (
            <Skeleton h={28} w="60%" />
          ) : (
            <span className="stat-value">
              <CountUp value={d.finished} format={(n) => String(Math.round(n))} />
              <small>%</small>
            </span>
          )}
        </button>
      </div>

      <div className="section-title">Monthly spending</div>
      <div className="card">
        <div className="caption">This month</div>
        <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
          {dt(d.monthly[d.monthly.length - 1].total)}
        </div>
        <div className="bars">
          {d.monthly.map((m, i) => (
            <div key={m.key} className={`bar ${i === d.monthly.length - 1 ? 'current' : ''}`} title={dt(m.total)}>
              <div style={{ height: `${(m.total / maxMonth) * 92}px` }} />
              <span>{fmtMonthShort(m.date)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section-title">
        Recent expenses
        {recent.length > 0 && (
          <button className="link" onClick={() => goTo('expenses')}>
            See all
          </button>
        )}
      </div>
      {loading ? (
        <div className="card">
          <Skeleton h={18} w="60%" />
          <Skeleton h={14} w="40%" style={{ marginTop: 8 }} />
        </div>
      ) : recent.length ? (
        <div className="list">
          {recent.map((e) => (
            <ExpenseRow key={e.id} e={e} />
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty
            icon={<Receipt size={30} />}
            text="No expenses yet. Tap + to log your first one in a few seconds."
            action="Add expense"
            onAction={() => {
              primeKeyboard()
              nav.openSheet(() => <ExpenseSheet />)
            }}
          />
        </div>
      )}

      <div className="section-title">More</div>
      <div className="list">
        <Row icon={<Images size={17} />} iconBg="#34C759" title="Photo timeline" onClick={() => nav.push(<Timeline />)} />
        <Row icon={<FileText size={17} />} iconBg="#5856D6" title="Documents" sub="Quotes, contracts, invoices" onClick={() => nav.push(<Documents />)} />
      </div>
    </Page>
  )
}

function Stat({
  label,
  icon,
  color,
  value,
  onClick,
  loading,
}: {
  label: string
  icon: React.ReactNode
  color: string
  value: number
  onClick: () => void
  loading: boolean
}) {
  return (
    <button className="stat press" onClick={onClick}>
      <span className="stat-label">
        <span className="icon-dot" style={{ background: color }}>
          {icon}
        </span>
        {label}
      </span>
      {loading ? (
        <Skeleton h={28} w="80%" />
      ) : (
        <span className="stat-value">
          <CountUp value={value} format={(n) => num(n, true)} />
          <small>DT</small>
        </span>
      )}
    </button>
  )
}
