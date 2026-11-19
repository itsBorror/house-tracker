import { useEffect, useState } from 'react'
import { Delete } from 'lucide-react'
import { checkPin } from '../lib/pin'

export function PinPad({ title, onComplete, error }: { title: string; onComplete: (pin: string) => void; error?: string }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  useEffect(() => {
    if (error) {
      setShake(true)
      setPin('')
      const t = setTimeout(() => setShake(false), 450)
      return () => clearTimeout(t)
    }
  }, [error])
  const press = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) setTimeout(() => onComplete(next), 120)
  }
  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{title}</div>
      <div className={`pin-dots ${shake ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} className="num">
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => press('0')} className="num">
          0
        </button>
        <button className="ghost" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete">
          <Delete size={26} />
        </button>
      </div>
      {error && <p className="err">{error}</p>}
    </>
  )
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [err, setErr] = useState('')
  const [n, setN] = useState(0)
  return (
    <div className="lock">
      <PinPad
        key={n}
        title="Enter PIN"
        error={err}
        onComplete={async (p) => {
          if (await checkPin(p)) onUnlock()
          else {
            setErr('Wrong PIN, try again')
            setN((x) => x + 1)
          }
        }}
      />
    </div>
  )
}
