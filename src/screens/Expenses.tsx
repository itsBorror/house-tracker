import { useMemo, useState } from 'react'
import { ChevronDown, Download, Receipt } from 'lucide-react'
import { Empty, Page, Progress, SearchBar, Segmented, Sheet, primeKeyboard, useCloseSheet, useNav } from '../components/ui'
import { ExpenseRow, categoryStyle, expenseTitle, useNames } from '../components/ExpenseRow'
import { useRows, useSettings } from '../lib/store'
import { dt, sum } from '../lib/format'
import { addMonths, monthKey, relativeDay } from '../lib/dates'
import { exportExpensesCSV, shareFile } from '../lib/backup'
import { ExpenseSheet } from './ExpenseSheet'

type Period = 'all' | 'this' | 'last'

export function Expenses() {
  const nav = useNav()
  const all = useRows('expenses')
  const areas = useRows('areas').sort((a, b) => a.sort - b.sort)
  const { categories } = useSettings()
  const names = useNames()
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>('this')
  const [cat, setCat] = useState<string | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const filtered = useMemo(() => {
    const now = new Date()
    const mk = period === 'this' ? monthKey(now) : period === 'last' ? monthKey(addMonths(now, -1)) : null
    const query = q.trim().toLowerCase()
    return all
      .filter((e) => (mk ? e.date.startsWith(mk) : true))
      .filter((e) => (cat ? e.category === cat : true))
      .filter((e) => (area ? e.area_id === area : true))
      .filter((e) => {
        if (!query) return true
        const hay = [expenseTitle(e, names), e.category, e.note, e.paid_to, e.area_id ? names.areas[e.area_id] : '', String(e.amount)]
          .join(' ')
          .toLowerCase()
        return hay.includes(query)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''))
  }, [all, period, cat, area, q, names])

  const total = sum(filtered, (e) => e.amount)
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of filtered) m.set(e.category, (m.get(e.category) || 0) + Number(e.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  const groups = useMemo(() => {
    const g: { date: string; items: typeof filtered }[] = []
    for (const e of filtered) {
      const last = g[g.length - 1]
      if (last && last.date === e.date) last.items.push(e)
      else g.push({ date: e.date, items: [e] })
    }
    return g
  }, [filtered])

  const pick = (title: string, options: { id: string; label: string }[], value: string | null, onPick: (v: string | null) => void) =>
    nav.openSheet(() => <PickerSheet title={title} options={options} value={value} onPick={onPick} />)

  const periodLabel = period === 'this' ? 'This month' : period === 'last' ? 'Last month' : 'All time'

  return (
    <Page
      title="Expenses"
      right={
        <button className="nav-btn" onClick={() => shareFile(exportExpensesCSV(), 'house-expenses.csv')} aria-label="Export CSV">
          <Download size={22} />
        </button>
      }
    >
      <SearchBar value={q} onChange={setQ} placeholder="Search expenses" />
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'all', label: 'All' },
          { value: 'this', label: 'This month' },
          { value: 'last', label: 'Last month' },
        ]}
      />
      <div className="chips">
        <button
          className={`chip press ${cat ? 'on' : ''}`}
          onClick={() => pick('Category', [...new Set([...categories, ...all.map((e) => e.category)])].map((c) => ({ id: c, label: c })), cat, setCat)}
        >
          {cat || 'Category'} <ChevronDown size={14} />
        </button>
        <button
          className={`chip press ${area ? 'on' : ''}`}
          onClick={() => pick('Area', areas.map((a) => ({ id: a.id, label: a.name })), area, setArea)}
        >
          {area ? names.areas[area] : 'Area'} <ChevronDown size={14} />
        </button>
        {(cat || area) && (
          <button className="chip press" onClick={() => (setCat(null), setArea(null))}>
            Clear
          </button>
        )}
      </div>

      <button className="card press" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => setShowBreakdown(!showBreakdown)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="caption">{periodLabel} total</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
              {dt(total)}
            </div>
          </div>
          <span className="caption" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--blue)' }}>
            By category <ChevronDown size={14} style={{ transform: showBreakdown ? 'rotate(180deg)' : '', transition: 'transform .2s' }} />
          </span>
        </div>
        {showBreakdown && (
          <div style={{ marginTop: 14, display: 'grid', gap: 12, animation: 'fade-in .25s' }}>
            {byCat.length === 0 && <div className="caption">Nothing here yet.</div>}
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 6 }}>
                  <span>{c}</span>
                  <span className="num muted">{dt(v)}</span>
                </div>
                <Progress value={total ? (v / total) * 100 : 0} color={categoryStyle(c).color} height={6} />
              </div>
            ))}
          </div>
        )}
      </button>

      {groups.length === 0 ? (
        <Empty
          icon={<Receipt size={30} />}
          text={all.length ? 'No expenses match these filters.' : 'No expenses yet. Log one in seconds with the + button.'}
          action={all.length ? undefined : 'Add expense'}
          onAction={() => {
            primeKeyboard()
            nav.openSheet(() => <ExpenseSheet />)
          }}
        />
      ) : (
        groups.map((g) => (
          <div key={g.date}>
            <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{relativeDay(g.date)}</span>
              <span className="num">{dt(sum(g.items, (e) => e.amount))}</span>
            </div>
            <div className="list">
              {g.items.map((e) => (
                <ExpenseRow key={e.id} e={e} showDate={false} />
              ))}
            </div>
          </div>
        ))
      )}
    </Page>
  )
}

function PickerSheet({
  title,
  options,
  value,
  onPick,
}: {
  title: string
  options: { id: string; label: string }[]
  value: string | null
  onPick: (v: string | null) => void
}) {
  const close = useCloseSheet()
  const choose = (v: string | null) => {
    onPick(v)
    close()
  }
  return (
    <Sheet title={title}>
      <div className="list">
        <button className="row" onClick={() => choose(null)}>
          <div className="row-main">All</div>
          {value == null && <span style={{ color: 'var(--blue)' }}>✓</span>}
        </button>
        {options.map((o) => (
          <button className="row" key={o.id} onClick={() => choose(o.id)}>
            <div className="row-main">{o.label}</div>
            {value === o.id && <span style={{ color: 'var(--blue)' }}>✓</span>}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
