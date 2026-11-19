import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Logo() {
  return <img src="/apple-touch-icon.png" alt="" className="app-logo" />
}

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setInfo('')
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Check your email and tap the confirmation link, then come back and sign in.')
          setMode('in')
        }
      }
    } catch (e) {
      const m = (e as Error).message || 'Something went wrong'
      setErr(/fetch|network/i.test(m) ? 'You seem to be offline. Connect to the internet to sign in.' : m)
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!email.trim()) {
      setErr('Type your email first, then tap "Forgot password".')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    if (error) setErr(error.message)
    else setInfo('We sent you an email with a link to reset your password.')
  }

  return (
    <form className="center-screen" onSubmit={submit}>
      <Logo />
      <h1>House Tracker</h1>
      <p className="lead">{mode === 'in' ? 'Sign in to see your house.' : 'Create your account. Your partner creates their own.'}</p>
      <div className="field-list">
        <div className="field">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ textAlign: 'left' }}
            required
          />
        </div>
        <div className="field">
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder={mode === 'in' ? 'Password' : 'Password (at least 6 characters)'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ textAlign: 'left' }}
            minLength={6}
            required
          />
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {info && <p className="hint" style={{ justifyContent: 'center' }}>{info}</p>}
      <div className="spacer" />
      <button className="btn" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'Create an account' : 'I already have an account'}
      </button>
      {mode === 'in' && (
        <button type="button" className="nav-btn" style={{ margin: '12px auto 0' }} onClick={reset}>
          Forgot password?
        </button>
      )}
    </form>
  )
}

export function HouseholdSetup({ onReady }: { onReady: (hid: string) => void }) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [name, setName] = useState('Our house')
  const [me, setMe] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      if (mode === 'create') {
        const { data, error } = await supabase.rpc('create_household', { p_name: name, p_display_name: me })
        if (error) throw error
        onReady((data as { id: string }).id)
      } else {
        const { data, error } = await supabase.rpc('join_household', { p_code: code, p_display_name: me })
        if (error) throw error
        onReady(data as string)
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'choose')
    return (
      <div className="center-screen">
        <Logo />
        <h1>Welcome</h1>
        <p className="lead">One of you creates the house. The other joins with a 6-letter code.</p>
        <button className="btn" onClick={() => setMode('create')}>
          Create our house
        </button>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setMode('join')}>
          Join with a code
        </button>
        <button className="nav-btn" style={{ margin: '16px auto 0' }} onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    )

  return (
    <div className="center-screen">
      <Logo />
      <h1>{mode === 'create' ? 'Create your house' : 'Join your house'}</h1>
      <p className="lead">
        {mode === 'create'
          ? 'You will get a code to share with your partner in Settings.'
          : 'Ask your partner for the code. It is in Settings on their phone.'}
      </p>
      <div className="field-list">
        {mode === 'create' ? (
          <div className="field">
            <label>House name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect="off"
              maxLength={6}
            />
          </div>
        )}
        <div className="field">
          <label>Your name</label>
          <input value={me} onChange={(e) => setMe(e.target.value)} placeholder="e.g. Sami" />
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="spacer" />
      <button className="btn" disabled={busy || (mode === 'join' && code.trim().length < 6)} onClick={go}>
        {busy ? 'Please wait…' : mode === 'create' ? 'Create' : 'Join'}
      </button>
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setMode('choose')}>
        Back
      </button>
    </div>
  )
}
