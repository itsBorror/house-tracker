import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Hammer, House, Plus, Receipt, Users, Wallet } from 'lucide-react'
import { isConfigured, supabase } from './lib/supabase'
import { startStore, stopStore } from './lib/store'
import { hasPin } from './lib/pin'
import { NavProvider, ToastHost, primeKeyboard, useNav } from './components/ui'
import { HouseholdSetup, Login, Logo, NotConfigured } from './screens/Auth'
import { LockScreen } from './screens/Lock'
import { Home } from './screens/Home'
import { Expenses } from './screens/Expenses'
import { Debt } from './screens/Debt'
import { Work } from './screens/Work'
import { Workers } from './screens/Workers'
import { ExpenseSheet } from './screens/ExpenseSheet'

export type Tab = 'home' | 'expenses' | 'debt' | 'work' | 'workers'

const hidKey = (uid: string) => `ht:hid:${uid}`
const readHid = (uid: string) => {
  try {
    return localStorage.getItem(hidKey(uid))
  } catch {
    return null
  }
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return <Authed />
}

function Authed() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [hid, setHid] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) {
      setHid(session === null ? null : undefined)
      return
    }
    const cached = readHid(uid)
    if (cached) setHid(cached)
    supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', uid)
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          if (!cached) setHid(navigator.onLine ? null : undefined)
          return
        }
        const found = data?.[0]?.household_id ?? null
        if (found) localStorage.setItem(hidKey(uid), found)
        else localStorage.removeItem(hidKey(uid))
        setHid(found)
      })
  }, [uid, session])

  useEffect(() => {
    if (uid && hid) startStore(hid, uid)
    if (session === null) stopStore()
  }, [uid, hid, session])

  if (session === undefined || (session && hid === undefined))
    return (
      <div className="center-screen">
        <Logo />
      </div>
    )
  if (!session) return <Login />
  if (!hid)
    return (
      <HouseholdSetup
        onReady={(id) => {
          localStorage.setItem(hidKey(session.user.id), id)
          setHid(id)
        }}
      />
    )
  return (
    <NavProvider>
      <Shell />
      <ToastHost />
      <PinGate />
    </NavProvider>
  )
}

/** Locks the app on open and after 60 s in the background, if a PIN is set. */
function PinGate() {
  const [locked, setLocked] = useState(hasPin())
  const hiddenAt = useRef<number | null>(null)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hasPin() && hiddenAt.current && Date.now() - hiddenAt.current > 60_000) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  if (!locked) return null
  return <LockScreen onUnlock={() => setLocked(false)} />
}

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'debt', label: 'Debt', icon: Wallet },
  { id: 'work', label: 'Work', icon: Hammer },
  { id: 'workers', label: 'Workers', icon: Users },
]

function Shell() {
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('ht:tab') as Tab) || 'home')
  const nav = useNav()
  useEffect(() => {
    sessionStorage.setItem('ht:tab', tab)
    window.scrollTo(0, 0)
  }, [tab])

  const quickAdd = () => {
    primeKeyboard()
    nav.openSheet(() => <ExpenseSheet />)
  }

  return (
    <>
      <main key={tab}>
        {tab === 'home' && <Home goTo={setTab} />}
        {tab === 'expenses' && <Expenses />}
        {tab === 'debt' && <Debt />}
        {tab === 'work' && <Work />}
        {tab === 'workers' && <Workers />}
      </main>
      <button className="fab" onClick={quickAdd} aria-label="Add expense">
        <Plus size={30} strokeWidth={2.4} />
      </button>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={25} strokeWidth={tab === t.id ? 2.1 : 1.7} />
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
