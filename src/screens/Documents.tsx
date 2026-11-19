import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Empty, Page, PhotoButton, PhotoImg, PhotoViewer, Sheet, toast, useCloseSheet, useNav } from '../components/ui'
import { useRows } from '../lib/store'
import { addPhoto, deletePhoto } from '../lib/photos'
import { fmtDate, today } from '../lib/dates'
import type { Photo } from '../lib/types'

export function Documents() {
  const nav = useNav()
  const docs = useRows('photos')
    .filter((p) => p.kind === 'document')
    .sort((a, b) => b.date.localeCompare(a.date))
  const [view, setView] = useState<Photo | null>(null)
  const add = (f: File) => nav.openSheet(() => <DocumentSheet file={f} />)
  return (
    <Page title="Documents" back="Home">
      {docs.length === 0 ? (
        <Empty icon={<FileText size={30} />} text="Keep photos of quotes, contracts and invoices here, with a title and date." />
      ) : (
        <div className="photo-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
          {docs.map((d) => (
            <button key={d.id} className="ph press" onClick={() => setView(d)} style={{ aspectRatio: '3 / 4' }}>
              <PhotoImg photo={d} />
              <span className="ph-caption" style={{ fontSize: 13 }}>
                <b>{d.title || 'Document'}</b>
                <br />
                {fmtDate(d.date, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </button>
          ))}
        </div>
      )}
      <PhotoButton onFile={add} label="Add document" className="btn" />
      {view && (
        <PhotoViewer
          photo={view}
          onClose={() => setView(null)}
          onDelete={() => (deletePhoto(view), setView(null))}
          caption={`${view.title || 'Document'} · ${fmtDate(view.date, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        />
      )}
    </Page>
  )
}

function DocumentSheet({ file }: { file: File }) {
  const close = useCloseSheet()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today())
  const [url] = useState(() => URL.createObjectURL(file))
  const submit = async () => {
    await addPhoto(file, { kind: 'document', title: title.trim() || 'Document', date })
    toast('Document saved')
    close()
  }
  return (
    <Sheet title="New document" onDone={submit}>
      <img src={url} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12, background: 'var(--fill)', marginBottom: 16 }} />
      <div className="field-list">
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Electrician quote" autoFocus />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        </div>
      </div>
    </Sheet>
  )
}
