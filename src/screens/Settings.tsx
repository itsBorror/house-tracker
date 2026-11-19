import { useEffect, useRef, useState } from 'react'
import { Copy, Download, KeyRound, Layers, LogOut, RefreshCw, Share, Tag, Upload, Users } from 'lucide-react'
import { Page, Row, Sheet, SwipeRow, toast, useActionSheet, useCloseSheet, useConfirmDelete, useNav } from '../components/ui'
import { saveSettings, sync, useRows, useSettings, useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { clearPin, hasPin, setPin } from '../lib/pin'
import { exportExpensesCSV, exportJSON, restoreJSON, shareFile } from '../lib/backup'
import { WEEKDAYS, today } from '../lib/dates'
import { PinPad } from './Lock'
import { AreaSheet } from './Work'

type Household = { id: string; name: string; join_code: string }
type Member = { user_id: string; display_name: string | null }

export function Settings() {
  const nav = useNav()
  const store = useStore()
  const settings = useSettings()
  const ask = useActionSheet()
  const [house, setHouse] = useState<Household | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [pinOn, setPinOn] = useState(hasPin())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!store.householdId) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
    supabase
      .from('households')
      .select('id,name,join_code')
      .eq('id', store.householdId)
      .single()
      .then(({ data }) => data && setHouse(data as Household))
    supabase
      .from('household_members')
      .select('user_id,display_name')
      .eq('household_id', store.householdId)
      .then(({ data }) => data && setMembers(data as Member[]))
  }, [store.householdId])

  const shareCode = async () => {
    if (!house) return
    const text = `Join our House Tracker with code ${house.join_code}`
    if (navigator.share) navigator.share({ text }).catch(() => undefined)
    else {
      await navigator.clipboard?.writeText(house.join_code)
      toast('Code copied')
    }
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone

  return (
    <Page title="Settings" back="Home">
      {!standalone && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Install on your iPhone</div>
          <div className="caption" style={{ fontSize: 15 }}>
            In Safari, tap <Share size={14} style={{ verticalAlign: -2 }} /> Share, then <b>Add to Home Screen</b>. The app then opens full screen and
            works offline.
          </div>
        </div>
      )}

      <div className="list-header">House</div>
      <div className="list">
        <Row icon={<Users size={17} />} iconBg="#007AFF" title={house?.name || 'Our house'} sub={members.map((m) => m.display_name || 'Member').join(' & ') || ' '} />
        <Row
          icon={<Copy size={17} />}
          iconBg="#34C759"
          title="Invite code"
          sub={members.length < 2 ? 'Your partner enters this after creating their account' : 'Both of you are in'}
          value={<span style={{ letterSpacing: 2, fontWeight: 600, color: 'var(--text)' }}>{house?.join_code || '······'}</span>}
          onClick={shareCode}
        />
      </div>

      <div className="list-header">Workers</div>
      <div className="list">
        <div className="field" style={{ background: 'var(--card)' }}>
          <label>Payday</label>
          <select value={settings.worker_payday} onChange={(e) => (saveSettings({ worker_payday: Number(e.target.value) }), toast('Payday updated'))}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="list-header">Lists</div>
      <div className="list">
        <Row icon={<Tag size={17} />} iconBg="#FF9500" title="Categories" value={settings.categories.length} onClick={() => nav.push(<Categories />)} />
        <Row icon={<Layers size={17} />} iconBg="#5856D6" title="Areas" onClick={() => nav.push(<Areas />)} />
      </div>

      <div className="list-header">Security</div>
      <div className="list">
        <Row
          icon={<KeyRound size={17} />}
          iconBg="#8E8E93"
          title="PIN lock"
          value={pinOn ? 'On' : 'Off'}
          onClick={() =>
            pinOn
              ? ask('PIN lock', [
                  { label: 'Change PIN', onPress: () => nav.openSheet(() => <SetPinSheet onDone={() => setPinOn(true)} />) },
                  { label: 'Turn off PIN', destructive: true, onPress: () => (clearPin(), setPinOn(false), toast('PIN turned off')) },
                ])
              : nav.openSheet(() => <SetPinSheet onDone={() => setPinOn(true)} />)
          }
        />
      </div>
      <p className="footnote">The PIN is only on this phone. It asks for it when you open the app.</p>

      <div className="list-header">Backup &amp; export</div>
      <div className="list">
        <Row icon={<Download size={17} />} iconBg="#007AFF" title="Back up all data (JSON)" onClick={() => shareFile(exportJSON(), `house-tracker-backup-${today()}.json`)} />
        <Row icon={<Download size={17} />} iconBg="#34C759" title="Export expenses (CSV)" onClick={() => shareFile(exportExpensesCSV(), `house-expenses-${today()}.csv`)} />
        <Row icon={<Upload size={17} />} iconBg="#FF9500" title="Restore from backup" onClick={() => fileRef.current?.click()} />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const n = await restoreJSON(f)
            toast(`Restored ${n} items`)
          } catch (err) {
            alert((err as Error).message)
          }
        }}
      />
      <p className="footnote">Photos stay in your cloud storage and are not inside the backup file.</p>

      <div className="list-header">Sync</div>
      <div className="list">
        <Row
          icon={<RefreshCw size={17} />}
          iconBg="#30B0C7"
          title={store.syncing ? 'Syncing…' : store.online ? 'Up to date' : 'Offline'}
          sub={
            (store.outbox.length ? `${store.outbox.length} change${store.outbox.length === 1 ? '' : 's'} waiting to sync · ` : '') +
            (store.lastSync ? `Last synced ${new Date(store.lastSync).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Not synced yet')
          }
          onClick={() => sync()}
        />
      </div>
      {store.error && <p className="footnote" style={{ color: 'var(--red)' }}>{store.error}</p>}

      <div className="list-header">Account</div>
      <div className="list">
        <Row
          icon={<LogOut size={17} />}
          iconBg="#FF3B30"
          title="Sign out"
          sub={email}
          onClick={() =>
            ask(store.outbox.length ? 'Some changes have not synced yet. Signing out now would lose them.' : 'Sign out of House Tracker?', [
              {
                label: 'Sign out',
                destructive: true,
                onPress: async () => {
                  await supabase.auth.signOut()
                  location.reload()
                },
              },
            ])
          }
        />
      </div>
      <p className="footnote" style={{ textAlign: 'center', marginTop: 24 }}>
        House Tracker · amounts in Tunisian dinars (DT)
      </p>
    </Page>
  )
}

function SetPinSheet({ onDone }: { onDone: () => void }) {
  const close = useCloseSheet()
  const [first, setFirst] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [k, setK] = useState(0)
  return (
    <Sheet title="Set PIN">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 24px' }}>
        <PinPad
          key={k}
          title={first ? 'Enter it again' : 'Choose a 4-digit PIN'}
          error={err}
          onComplete={async (p) => {
            if (!first) {
              setFirst(p)
              setErr('')
              setK(k + 1)
            } else if (p === first) {
              await setPin(p)
              toast('PIN is on')
              onDone()
              close()
            } else {
              setFirst(null)
              setErr("PINs didn't match, start again")
              setK(k + 1)
            }
          }}
        />
      </div>
    </Sheet>
  )
}

function Categories() {
  const { categories } = useSettings()
  const confirmDelete = useConfirmDelete()
  const [name, setName] = useState('')
  const add = () => {
    const c = name.trim()
    if (!c || categories.includes(c)) return
    saveSettings({ categories: [...categories, c] })
    setName('')
    toast('Category added')
  }
  return (
    <Page title="Categories" back="Settings">
      <div className="list">
        {categories.map((c) => (
          <SwipeRow key={c} onDelete={() => confirmDelete('category', () => saveSettings({ categories: categories.filter((x) => x !== c) }))}>
            <Row title={c} />
          </SwipeRow>
        ))}
      </div>
      <p className="footnote">Swipe left on a category to delete it. Old expenses keep their category.</p>
      <div className="list-header">New category</div>
      <div className="field-list">
        <div className="field">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen" style={{ textAlign: 'left' }} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn small" onClick={add} disabled={!name.trim()}>
            Add
          </button>
        </div>
      </div>
    </Page>
  )
}

function Areas() {
  const nav = useNav()
  const areas = useRows('areas').sort((a, b) => a.sort - b.sort)
  return (
    <Page
      title="Areas"
      back="Settings"
      right={
        <button className="nav-btn" onClick={() => nav.openSheet(() => <AreaSheet />)}>
          Add
        </button>
      }
    >
      <div className="list">
        {areas.map((a) => (
          <Row key={a.id} title={a.name} onClick={() => nav.openSheet(() => <AreaSheet area={a} />)} />
        ))}
      </div>
      <p className="footnote">Tap an area to rename it.</p>
    </Page>
  )
}
