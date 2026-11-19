import { useMemo, useState } from 'react'
import { Camera, Check, Hammer, ListPlus, Plus } from 'lucide-react'
import {
  AmountInput,
  Empty,
  Hint,
  Page,
  PhotoButton,
  PhotoImg,
  PhotoViewer,
  Pill,
  Progress,
  Ring,
  Row,
  Segmented,
  Sheet,
  SwipeRow,
  primeKeyboard,
  toast,
  useActionSheet,
  useCloseSheet,
  useConfirmDelete,
  useNav,
} from '../components/ui'
import { remove, save, useRows } from '../lib/store'
import { workProgress } from '../lib/calc'
import { dt, parseAmount, sum } from '../lib/format'
import { fmtDate, today } from '../lib/dates'
import { addPhoto, deletePhoto } from '../lib/photos'
import { STATUS_LABEL, type Area, type Photo, type WorkItem, type WorkStatus } from '../lib/types'
import { ExpenseSheet } from './ExpenseSheet'

const NEXT: Record<WorkStatus, WorkStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }

function useAreas() {
  return useRows('areas').sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
}

/** Change a task's status; when it becomes Done, offer to log the real cost. */
function useSetStatus() {
  const nav = useNav()
  const ask = useActionSheet()
  return (item: WorkItem, status: WorkStatus) => {
    save('work_items', { id: item.id, status })
    if (navigator.vibrate) navigator.vibrate(8)
    if (status === 'done') {
      toast('Task done')
      ask(`“${item.title}” is done. Log the actual cost as an expense?`, [
        {
          label: 'Log actual cost',
          bold: true,
          onPress: () => {
            primeKeyboard()
            nav.openSheet(() => (
              <ExpenseSheet
                title="Actual cost"
                preset={{ amount: item.estimated_cost || undefined, area_id: item.area_id, work_item_id: item.id, note: item.title }}
              />
            ))
          },
        },
      ])
    }
  }
}

export function StatusButton({ item }: { item: WorkItem }) {
  const setStatus = useSetStatus()
  return (
    <button
      className="status-btn"
      aria-label={`Status: ${STATUS_LABEL[item.status]}. Tap to change.`}
      onClick={(e) => {
        e.stopPropagation()
        setStatus(item, NEXT[item.status])
      }}
    >
      <span className={`status-cycle ${item.status}`}>{item.status === 'done' && <Check size={16} strokeWidth={3} />}</span>
    </button>
  )
}

export function Work() {
  const nav = useNav()
  const areas = useAreas()
  const items = useRows('work_items')
  const [view, setView] = useState<'areas' | 'remaining'>('areas')
  const all = workProgress(items)

  return (
    <Page
      title="Work"
      right={
        <button className="nav-btn" onClick={() => nav.openSheet(() => <AreaSheet />)} aria-label="Add area">
          <Plus size={26} />
        </button>
      }
    >
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Ring value={all.progress} size={76} stroke={8} color="var(--green)">
          <span className="num" style={{ fontWeight: 700, fontSize: 18 }}>
            {Math.round(all.progress)}%
          </span>
        </Ring>
        <div style={{ minWidth: 0 }}>
          <div className="caption">Work left to pay for</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
            {dt(all.remainingCost, { short: true })}
          </div>
          <div className="caption">
            {all.doneCount} of {all.count} tasks done
          </div>
        </div>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'areas', label: 'By area' },
          { value: 'remaining', label: 'Remaining list' },
        ]}
      />

      {view === 'areas' ? (
        areas.length === 0 ? (
          <Empty icon={<Hammer size={30} />} text="Add the areas of your house, like Ground floor or Roof." action="Add area" onAction={() => nav.openSheet(() => <AreaSheet />)} />
        ) : (
          <div className="list">
            {areas.map((a) => {
              const p = workProgress(items.filter((i) => i.area_id === a.id))
              return (
                <Row
                  key={a.id}
                  left={
                    <Ring value={p.progress} size={36} stroke={4} color={p.progress >= 100 ? 'var(--green)' : 'var(--blue)'}>
                      <span style={{ fontSize: 9, fontWeight: 700 }} className="num">
                        {Math.round(p.progress)}
                      </span>
                    </Ring>
                  }
                  title={a.name}
                  sub={p.count ? `${p.doneCount} of ${p.count} done · ${dt(p.remainingCost, { short: true })} left` : 'No tasks yet'}
                  onClick={() => nav.push(<AreaDetail id={a.id} />)}
                />
              )
            })}
          </div>
        )
      ) : (
        <RemainingList areas={areas} items={items} />
      )}
      {view === 'areas' && items.length === 0 && areas.length > 0 && (
        <Hint>Open an area and use “Bulk add” to type all its tasks at once, one per line, with the cost at the end.</Hint>
      )}
    </Page>
  )
}

function RemainingList({ areas, items }: { areas: Area[]; items: WorkItem[] }) {
  const nav = useNav()
  const open = items.filter((i) => i.status !== 'done')
  const total = sum(open, (i) => i.estimated_cost)
  if (!open.length)
    return <Empty icon={<Check size={30} />} text={items.length ? 'Everything is done. Congratulations!' : 'No tasks yet. Add them inside each area.'} />
  return (
    <>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="caption">{open.length} unfinished tasks</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
            {dt(total)}
          </div>
        </div>
        <Pill color="orange">Remaining</Pill>
      </div>
      {areas.map((a) => {
        const list = open.filter((i) => i.area_id === a.id).sort((x, y) => x.sort - y.sort)
        if (!list.length) return null
        return (
          <div key={a.id}>
            <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{a.name}</span>
              <span className="num">{dt(sum(list, (i) => i.estimated_cost), { short: true })}</span>
            </div>
            <div className="list">
              {list.map((i) => (
                <Row
                  key={i.id}
                  left={<StatusButton item={i} />}
                  title={i.title}
                  sub={STATUS_LABEL[i.status]}
                  value={dt(i.estimated_cost, { short: true })}
                  onClick={() => nav.openSheet(() => <TaskSheet area={a} item={i} />)}
                  chevron={false}
                />
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

function AreaDetail({ id }: { id: string }) {
  const nav = useNav()
  const confirmDelete = useConfirmDelete()
  const area = useRows('areas').find((a) => a.id === id)
  const allItems = useRows('work_items')
  const allPhotos = useRows('photos')
  const items = useMemo(() => allItems.filter((i) => i.area_id === id).sort((a, b) => a.sort - b.sort || (a.created_at || '').localeCompare(b.created_at || '')), [allItems, id])
  const photos = allPhotos.filter((p) => p.area_id === id && (p.kind === 'area' || p.kind === 'task')).sort((a, b) => b.date.localeCompare(a.date))
  const [view, setView] = useState<Photo | null>(null)
  if (!area) return <Page title="Area" back="Work" children={null} />
  const p = workProgress(items)

  return (
    <Page
      title={area.name}
      back="Work"
      right={
        <button className="nav-btn" onClick={() => nav.openSheet(() => <AreaSheet area={area} onDeleted={nav.pop} />)}>
          Edit
        </button>
      }
    >
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="num" style={{ fontSize: 28, fontWeight: 700 }}>
            {Math.round(p.progress)}%
          </span>
          <span className="caption">{dt(p.remainingCost, { short: true })} left</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Progress value={p.progress} color={p.progress >= 100 ? 'var(--green)' : 'var(--blue)'} />
        </div>
        <div className="caption" style={{ marginTop: 8 }}>
          {p.doneCount} of {p.count} tasks done · {dt(p.total, { short: true })} estimated in total
        </div>
      </div>

      <div className="btn-row">
        <button className="btn secondary" onClick={() => (primeKeyboard(), nav.openSheet(() => <TaskSheet area={area} />))}>
          <Plus size={20} /> Add task
        </button>
        <button className="btn secondary" onClick={() => nav.openSheet(() => <BulkAddSheet area={area} startSort={items.length} />)}>
          <ListPlus size={20} /> Bulk add
        </button>
      </div>

      <div className="list-header">Tasks</div>
      {items.length ? (
        <div className="list">
          {items.map((i) => (
            <SwipeRow
              key={i.id}
              onEdit={() => nav.openSheet(() => <TaskSheet area={area} item={i} />)}
              onDelete={() => confirmDelete('task', () => remove('work_items', i.id))}
            >
              <Row
                left={<StatusButton item={i} />}
                title={<span className={i.status === 'done' ? 'strike' : ''}>{i.title}</span>}
                sub={STATUS_LABEL[i.status]}
                value={dt(i.estimated_cost, { short: true })}
                chevron={false}
                onClick={() => nav.openSheet(() => <TaskSheet area={area} item={i} />)}
              />
            </SwipeRow>
          ))}
        </div>
      ) : (
        <div className="card caption">No tasks yet. Tap the circle on a task to move it from Not started → In progress → Done.</div>
      )}

      <div className="section-title">Progress photos</div>
      {photos.length > 0 && (
        <div className="photo-grid" style={{ marginBottom: 12 }}>
          {photos.map((ph) => (
            <button className="ph" key={ph.id} onClick={() => setView(ph)}>
              <PhotoImg photo={ph} />
              <span className="ph-caption">{fmtDate(ph.date)}</span>
            </button>
          ))}
        </div>
      )}
      <PhotoButton
        label="Add progress photo"
        onFile={async (f) => {
          await addPhoto(f, { kind: 'area', area_id: area.id, date: today() })
          toast('Photo added')
        }}
      />
      {view && (
        <PhotoViewer
          photo={view}
          onClose={() => setView(null)}
          onDelete={() => (deletePhoto(view), setView(null))}
          caption={`${view.title || area.name} · ${fmtDate(view.date, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        />
      )}
    </Page>
  )
}

export function AreaSheet({ area, onDeleted }: { area?: Area; onDeleted?: () => void }) {
  const close = useCloseSheet()
  const confirmDelete = useConfirmDelete()
  const areas = useRows('areas')
  const [name, setName] = useState(area?.name || '')
  const submit = () => {
    if (!name.trim()) return
    save('areas', { id: area?.id, name: name.trim(), sort: area?.sort ?? areas.length })
    toast(area ? 'Area renamed' : 'Area added')
    close()
  }
  return (
    <Sheet title={area ? 'Edit area' : 'New area'} onDone={submit} doneDisabled={!name.trim()}>
      <div className="field-list">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Garden" autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
      </div>
      {area && (
        <button
          className="btn danger"
          style={{ marginTop: 16 }}
          onClick={() =>
            confirmDelete('area', () => {
              remove('areas', area.id)
              close()
              onDeleted?.()
            })
          }
        >
          Delete area
        </button>
      )}
    </Sheet>
  )
}

function TaskSheet({ area, item }: { area: Area; item?: WorkItem }) {
  const close = useCloseSheet()
  const confirmDelete = useConfirmDelete()
  const setStatusWithPrompt = useSetStatus()
  const count = useRows('work_items').filter((i) => i.area_id === area.id).length
  const photos = useRows('photos').filter((p) => p.kind === 'task' && item && p.ref_id === item.id)
  const [title, setTitle] = useState(item?.title || '')
  const [cost, setCost] = useState(item ? String(item.estimated_cost || '') : '')
  const [status, setStatus] = useState<WorkStatus>(item?.status || 'todo')
  const [note, setNote] = useState(item?.note || '')
  const [view, setView] = useState<Photo | null>(null)
  const ok = title.trim().length > 0

  const submit = () => {
    if (!ok) return
    const becameDone = status === 'done' && item?.status !== 'done'
    const row = save('work_items', {
      id: item?.id,
      area_id: area.id,
      title: title.trim(),
      estimated_cost: parseAmount(cost) || 0,
      status: becameDone ? item?.status || 'todo' : status,
      note: note.trim() || null,
      sort: item?.sort ?? count,
    })
    close()
    if (becameDone) setStatusWithPrompt(row, 'done')
    else toast(item ? 'Task updated' : 'Task added')
  }

  return (
    <Sheet title={item ? 'Edit task' : 'New task'} onDone={submit} doneDisabled={!ok} doneLabel={item ? 'Save' : 'Add'}>
      <div className="field-list">
        <div className="field">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task name" style={{ textAlign: 'left' }} autoFocus={!item} />
        </div>
      </div>
      <div className="list-header">Estimated cost</div>
      <AmountInput value={cost} onChange={setCost} autoFocus={false} />
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: 'todo', label: 'Not started' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'done', label: 'Done' },
        ]}
      />
      <div className="field-list">
        <div className="field stack">
          <label>Notes</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ minHeight: 48 }} placeholder="Optional" />
        </div>
      </div>
      {item && (
        <>
          <div className="list-header">Photos</div>
          {photos.length > 0 && (
            <div className="photo-grid" style={{ marginBottom: 10 }}>
              {photos.map((p) => (
                <button className="ph" key={p.id} onClick={() => setView(p)}>
                  <PhotoImg photo={p} />
                </button>
              ))}
            </div>
          )}
          <PhotoButton
            label="Add photo"
            onFile={async (f) => {
              await addPhoto(f, { kind: 'task', ref_id: item.id, area_id: area.id, title: item.title })
              toast('Photo added')
            }}
          />
          <button className="btn danger" style={{ marginTop: 8 }} onClick={() => confirmDelete('task', () => (remove('work_items', item.id), close()))}>
            Delete task
          </button>
        </>
      )}
      {!item && (
        <p className="footnote">
          <Camera size={13} style={{ verticalAlign: -2 }} /> You can add photos after saving the task.
        </p>
      )}
      {view && <PhotoViewer photo={view} onClose={() => setView(null)} onDelete={() => (deletePhoto(view), setView(null))} />}
    </Sheet>
  )
}

/** Parse lines like "Plaster walls - 1200" or "Paint 850,500". */
export function parseBulk(text: string) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.*?)[\s:–—-]*([\d][\d\s.,]*)\s*(dt|tnd)?$/i)
      if (m && m[1].trim()) return { title: m[1].replace(/[\s:–—-]+$/, '').trim(), cost: parseAmount(m[2]) || 0 }
      return { title: l, cost: 0 }
    })
}

function BulkAddSheet({ area, startSort }: { area: Area; startSort: number }) {
  const close = useCloseSheet()
  const [text, setText] = useState('')
  const rows = parseBulk(text)
  const submit = () => {
    rows.forEach((r, i) => save('work_items', { area_id: area.id, title: r.title, estimated_cost: r.cost, status: 'todo', note: null, sort: startSort + i }))
    toast(`${rows.length} task${rows.length === 1 ? '' : 's'} added`)
    close()
  }
  return (
    <Sheet title={`Bulk add · ${area.name}`} onDone={submit} doneLabel="Add" doneDisabled={!rows.length}>
      <div className="field-list">
        <div className="field stack">
          <label>One task per line, cost at the end</label>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            style={{ minHeight: 180 }}
            placeholder={'Plaster walls - 1200\nElectrical wiring 3500\nInstall doors 2400'}
          />
        </div>
      </div>
      {rows.length > 0 && (
        <>
          <div className="list-header">
            Preview · {rows.length} tasks · {dt(sum(rows, (r) => r.cost), { short: true })}
          </div>
          <div className="list">
            {rows.map((r, i) => (
              <Row key={i} title={r.title} value={r.cost ? dt(r.cost, { short: true }) : '–'} />
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
