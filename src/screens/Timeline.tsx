import { useState } from 'react'
import { Images } from 'lucide-react'
import { Empty, Page, PhotoImg, PhotoViewer } from '../components/ui'
import { useRows } from '../lib/store'
import { deletePhoto } from '../lib/photos'
import { fmtDate } from '../lib/dates'
import type { Photo } from '../lib/types'

export function Timeline() {
  const areas = useRows('areas').sort((a, b) => a.sort - b.sort)
  const photos = useRows('photos').filter((p) => p.kind === 'area' || p.kind === 'task')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [view, setView] = useState<Photo | null>(null)
  const shown = photos.filter((p) => !areaId || p.area_id === areaId).sort((a, b) => b.date.localeCompare(a.date))
  const byDay: { date: string; items: Photo[] }[] = []
  for (const p of shown) {
    const last = byDay[byDay.length - 1]
    if (last && last.date === p.date) last.items.push(p)
    else byDay.push({ date: p.date, items: [p] })
  }
  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name || ''

  return (
    <Page title="Photo timeline" back="Home">
      <div className="chips">
        <button className={`chip press ${!areaId ? 'on' : ''}`} onClick={() => setAreaId(null)}>
          All areas
        </button>
        {areas.map((a) => (
          <button key={a.id} className={`chip press ${areaId === a.id ? 'on' : ''}`} onClick={() => setAreaId(a.id)}>
            {a.name}
          </button>
        ))}
      </div>
      {byDay.length === 0 ? (
        <Empty icon={<Images size={30} />} text="Open an area in Work and add progress photos. They show up here by date." />
      ) : (
        byDay.map((g) => (
          <div className="timeline-day" key={g.date}>
            <div className="list-header" style={{ marginTop: 8 }}>
              {fmtDate(g.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="photo-grid">
              {g.items.map((p) => (
                <button key={p.id} className="ph" onClick={() => setView(p)}>
                  <PhotoImg photo={p} />
                  {!areaId && <span className="ph-caption">{areaName(p.area_id)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      {view && (
        <PhotoViewer
          photo={view}
          onClose={() => setView(null)}
          onDelete={() => (deletePhoto(view), setView(null))}
          caption={`${view.title || areaName(view.area_id)} · ${fmtDate(view.date, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        />
      )}
    </Page>
  )
}
