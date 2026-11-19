import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Camera, Check, ChevronLeft, ChevronRight, Info, Pencil, Search, Trash2, X } from 'lucide-react'
import { usePhotoUrl } from '../lib/photos'
import type { Photo } from '../lib/types'

// ---------------------------------------------------------------------------
// Keyboard priming: iOS only opens the keyboard when focus happens inside the
// tap itself. We focus a hidden decimal input during the tap, then the real
// amount field takes focus a moment later and the keypad stays up.
// ---------------------------------------------------------------------------
let primer: HTMLInputElement | null = null
export function primeKeyboard() {
  if (!primer) {
    primer = document.createElement('input')
    primer.setAttribute('inputmode', 'decimal')
    primer.setAttribute('aria-hidden', 'true')
    primer.tabIndex = -1
    Object.assign(primer.style, { position: 'fixed', top: '0', left: '0', opacity: '0', height: '0', fontSize: '16px', pointerEvents: 'none' })
    document.body.appendChild(primer)
  }
  primer.focus()
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
type ToastState = { id: number; text: string; out?: boolean } | null
let setToastExternal: ((t: ToastState) => void) | null = null
let toastTimer: number | undefined

export function toast(text: string) {
  const id = Date.now()
  setToastExternal?.({ id, text })
  if (navigator.vibrate) navigator.vibrate(10)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    setToastExternal?.({ id, text, out: true })
    toastTimer = window.setTimeout(() => setToastExternal?.(null), 250)
  }, 1800)
}

export function ToastHost() {
  const [t, setT] = useState<ToastState>(null)
  useEffect(() => {
    setToastExternal = setT
    return () => {
      setToastExternal = null
    }
  }, [])
  if (!t) return null
  return createPortal(
    <div className={`toast ${t.out ? 'out' : ''}`} key={t.id} role="status">
      <span className="t-check">
        <Check size={16} strokeWidth={3} />
      </span>
      {t.text}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Navigation stack (pushed pages) and sheets
// ---------------------------------------------------------------------------
type Entry = { key: number; node: ReactNode; closing?: boolean }
type NavCtx = {
  push: (node: ReactNode) => void
  pop: () => void
  openSheet: (render: (close: () => void) => ReactNode) => void
}
const Nav = createContext<NavCtx>(null as unknown as NavCtx)
export const useNav = () => useContext(Nav)

const SheetClose = createContext<() => void>(() => undefined)
export const useCloseSheet = () => useContext(SheetClose)

let keySeq = 1
export function NavProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Entry[]>([])
  const [sheets, setSheets] = useState<Entry[]>([])

  const push = useCallback((node: ReactNode) => setPages((p) => [...p, { key: keySeq++, node }]), [])
  const pop = useCallback(() => {
    setPages((p) => {
      const idx = p.map((e) => !e.closing).lastIndexOf(true)
      if (idx < 0) return p
      const key = p[idx].key
      setTimeout(() => setPages((q) => q.filter((e) => e.key !== key)), 300)
      return p.map((e, i) => (i === idx ? { ...e, closing: true } : e))
    })
  }, [])

  const openSheet = useCallback((render: (close: () => void) => ReactNode) => {
    const key = keySeq++
    const close = () => {
      setSheets((s) => s.map((e) => (e.key === key ? { ...e, closing: true } : e)))
      setTimeout(() => setSheets((s) => s.filter((e) => e.key !== key)), 280)
    }
    setSheets((s) => [...s, { key, node: <SheetClose.Provider value={close}>{render(close)}</SheetClose.Provider> }])
  }, [])

  // Lock background scroll while a sheet is open.
  useEffect(() => {
    document.body.style.overflow = sheets.length || pages.length ? 'hidden' : ''
  }, [sheets.length, pages.length])

  return (
    <Nav.Provider value={{ push, pop, openSheet }}>
      {children}
      {pages.map((p) => (
        <div key={p.key} className={`pushed ${p.closing ? 'closing' : ''}`}>
          {p.node}
        </div>
      ))}
      {sheets.map((s) => (
        <SheetFrame key={s.key} closing={!!s.closing}>
          {s.node}
        </SheetFrame>
      ))}
    </Nav.Provider>
  )
}

const SheetClosing = createContext(false)

function SheetFrame({ children, closing }: { children: ReactNode; closing: boolean }) {
  return <SheetClosing.Provider value={closing}>{children}</SheetClosing.Provider>
}

/** Bottom sheet with a drag handle. Drag the handle/header down to close. */
export function Sheet({
  title,
  children,
  onDone,
  doneLabel = 'Save',
  doneDisabled,
  cancelLabel = 'Cancel',
}: {
  title: string
  children: ReactNode
  onDone?: () => void
  doneLabel?: string
  doneDisabled?: boolean
  cancelLabel?: string
}) {
  const close = useCloseSheet()
  const closing = useContext(SheetClosing)
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (ref.current) ref.current.style.transition = 'none'
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    ref.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const onUp = () => {
    if (!drag.current || !ref.current) return
    const { dy } = drag.current
    drag.current = null
    ref.current.style.transition = ''
    if (dy > 110) close()
    else ref.current.style.transform = ''
  }

  return createPortal(
    <>
      <div className={`backdrop ${closing ? 'closing' : ''}`} onClick={close} />
      <div className={`sheet ${closing ? 'closing' : ''}`} ref={ref} role="dialog" aria-label={title}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="sheet-handle" />
          <div className="sheet-head">
            <button className="nav-btn" onClick={close}>
              {cancelLabel}
            </button>
            <h2>{title}</h2>
            {onDone ? (
              <button className="nav-btn right" onClick={onDone} disabled={doneDisabled} style={{ opacity: doneDisabled ? 0.4 : 1 }}>
                {doneLabel}
              </button>
            ) : (
              <span style={{ minWidth: 72 }} />
            )}
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Page with large collapsing title
// ---------------------------------------------------------------------------
export function Page({
  title,
  children,
  right,
  back,
  sub,
}: {
  title: string
  children: ReactNode
  right?: ReactNode
  back?: string | boolean
  sub?: ReactNode
}) {
  const nav = useNav()
  const ref = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useLayoutEffect(() => {
    const scroller = ref.current?.closest('.pushed') as HTMLElement | null
    const target: HTMLElement | Window = scroller || window
    const read = () => setScrolled((scroller ? scroller.scrollTop : window.scrollY) > 30)
    read()
    target.addEventListener('scroll', read, { passive: true })
    return () => target.removeEventListener('scroll', read)
  }, [])
  return (
    <div className="page" ref={ref}>
      <div className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-side">
          {back && (
            <button className="nav-btn" onClick={nav.pop} style={{ paddingLeft: 0 }}>
              <ChevronLeft size={28} strokeWidth={2.2} />
              {typeof back === 'string' ? back : 'Back'}
            </button>
          )}
        </div>
        <div className="navbar-title">{title}</div>
        <div className="navbar-side" style={{ justifyContent: 'flex-end' }}>
          {right}
        </div>
      </div>
      <h1 className="large-title">{title}</h1>
      {sub && <div className="page-sub">{sub}</div>}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  const w = 100 / options.length
  return (
    <div className="segmented" role="tablist">
      <div className="thumb" style={{ width: `calc(${w}% - 4px)`, left: 2, transform: `translateX(${i * 100}%)`, marginLeft: i * 4 }} />
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, color = 'var(--blue)', height = 8 }: { value: number; color?: string; height?: number }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = requestAnimationFrame(() => setW(value))
    return () => cancelAnimationFrame(t)
  }, [value])
  return (
    <div className="progress" style={{ height }}>
      <div style={{ width: `${Math.max(0, Math.min(100, w))}%`, background: color }} />
    </div>
  )
}

export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = 'var(--blue)',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = requestAnimationFrame(() => setV(value))
    return () => cancelAnimationFrame(t)
  }, [value])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg className="ring" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, v)) / 100)}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

/** Animated number that counts up to its value. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    const dur = 600
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(a + (value - a) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value])
  return <span className="num">{format(shown)}</span>
}

export function Empty({ icon, text, action, onAction }: { icon: ReactNode; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="empty">
      <div className="e-icon">{icon}</div>
      <p>{text}</p>
      {action && (
        <button className="btn small" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}

export function Skeleton({ h = 16, w = '100%', r = 8, style }: { h?: number; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="hint">
      <Info size={16} />
      <div>{children}</div>
    </div>
  )
}

export function Row({
  title,
  sub,
  value,
  icon,
  iconBg,
  onClick,
  chevron = !!onClick,
  strong,
  left,
}: {
  title: ReactNode
  sub?: ReactNode
  value?: ReactNode
  icon?: ReactNode
  iconBg?: string
  onClick?: () => void
  chevron?: boolean
  strong?: boolean
  left?: ReactNode
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`row ${icon ? 'with-icon' : ''}`} onClick={onClick}>
      {left}
      {icon && (
        <span className="row-icon" style={{ background: iconBg || 'var(--blue)' }}>
          {icon}
        </span>
      )}
      <div className="row-main">
        <div className="row-title">{title}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {value != null && <div className={`row-value ${strong ? 'strong' : ''} num`}>{value}</div>}
      {chevron && <ChevronRight size={18} className="chev" />}
    </Tag>
  )
}

/** A row you can swipe left to reveal Edit and Delete. */
export function SwipeRow({ children, onEdit, onDelete }: { children: ReactNode; onEdit?: () => void; onDelete?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const st = useRef<{ x: number; y: number; dx: number; locked?: 'x' | 'y'; base: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [reveal, setReveal] = useState(false)
  const width = (onEdit ? 76 : 0) + (onDelete ? 76 : 0)

  const setX = (x: number, animate: boolean) => {
    const el = ref.current?.firstElementChild as HTMLElement | null
    if (!el) return
    el.style.transition = animate ? '' : 'none'
    el.style.transform = x ? `translateX(${x}px)` : ''
  }

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setX(0, true)
        setTimeout(() => setReveal(false), 260)
      }
    }
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('mousedown', close)
    return () => {
      document.removeEventListener('touchstart', close)
      document.removeEventListener('mousedown', close)
    }
  }, [open])

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    st.current = { x: t.clientX, y: t.clientY, dx: 0, base: open ? -width : 0 }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const s = st.current
    if (!s) return
    const t = e.touches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (!s.locked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (s.locked !== 'x') return
    if (!reveal) setReveal(true)
    s.dx = dx
    const x = Math.min(0, Math.max(-width - 40, s.base + dx))
    setX(x, false)
  }
  const onTouchEnd = () => {
    const s = st.current
    st.current = null
    if (!s || s.locked !== 'x') return
    const final = s.base + s.dx
    const shouldOpen = final < -width / 2
    setOpen(shouldOpen)
    setX(shouldOpen ? -width : 0, true)
    if (!shouldOpen) setTimeout(() => setReveal(false), 260)
  }

  const act = (fn?: () => void) => () => {
    setOpen(false)
    setX(0, true)
    setReveal(false)
    fn?.()
  }

  return (
    <div className="row-wrap" ref={ref} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {children}
      <div className="swipe-actions" style={{ visibility: reveal || open ? 'visible' : 'hidden' }}>
        {onEdit && (
          <button style={{ background: 'var(--text-2)' }} onClick={act(onEdit)}>
            <Pencil size={18} />
            Edit
          </button>
        )}
        {onDelete && (
          <button style={{ background: 'var(--red)' }} onClick={act(onDelete)}>
            <Trash2 size={18} />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

export function AmountInput({
  value,
  onChange,
  autoFocus = true,
  label = 'DT',
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 30)
  }, [autoFocus])
  return (
    <div className="amount-input">
      <input
        ref={ref}
        inputMode="decimal"
        enterKeyHint="done"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
        aria-label="Amount"
        className="num"
      />
      <div className="cur">{label}</div>
    </div>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="search">
      <Search size={17} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search" enterKeyHint="search" />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear" style={{ display: 'flex', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      )}
    </label>
  )
}

export function Pill({ color, children }: { color: 'green' | 'orange' | 'red' | 'gray' | 'blue'; children: ReactNode }) {
  return <span className={`pill ${color}`}>{children}</span>
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
export function PhotoImg({ photo, className = 'thumb-img' }: { photo: Photo; className?: string }) {
  const url = usePhotoUrl(photo)
  if (!url) return <Skeleton h={0} style={{ height: '100%', borderRadius: 0 }} />
  return <img src={url} alt={photo.title || 'Photo'} className={className} loading="lazy" />
}

export function PhotoViewer({ photo, onClose, onDelete, caption }: { photo: Photo; onClose: () => void; onDelete?: () => void; caption?: ReactNode }) {
  const url = usePhotoUrl(photo)
  return createPortal(
    <div className="viewer">
      <div className="viewer-bar">
        <button className="nav-btn" onClick={onClose}>
          Done
        </button>
        {onDelete && (
          <button className="nav-btn" onClick={onDelete} aria-label="Delete photo">
            <Trash2 size={20} />
          </button>
        )}
      </div>
      {url ? <img src={url} alt={photo.title || 'Photo'} /> : <div style={{ flex: 1 }} />}
      {caption && <div className="viewer-foot">{caption}</div>}
    </div>,
    document.body,
  )
}

/** A button that opens the camera / photo library. */
export function PhotoButton({ onFile, label = 'Add photo', className = 'btn secondary' }: { onFile: (f: File) => void; label?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button className={className} onClick={() => ref.current?.click()} type="button">
        <Camera size={20} />
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// iOS-style action sheet (used for confirmations)
// ---------------------------------------------------------------------------
export type Action = { label: string; destructive?: boolean; bold?: boolean; onPress: () => void }

function ActionSheet({ title, actions }: { title?: string; actions: Action[] }) {
  const close = useCloseSheet()
  const closing = useContext(SheetClosing)
  return createPortal(
    <>
      <div className={`backdrop ${closing ? 'closing' : ''}`} onClick={close} />
      <div className={`action-sheet ${closing ? 'closing' : ''}`} role="dialog">
        <div className="as-group">
          {title && <div className="as-title">{title}</div>}
          {actions.map((a) => (
            <button
              key={a.label}
              className={`as-btn ${a.destructive ? 'destructive' : ''} ${a.bold ? 'bold' : ''}`}
              onClick={() => {
                close()
                a.onPress()
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="as-group">
          <button className="as-btn bold" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

export function useActionSheet() {
  const { openSheet } = useNav()
  return useCallback((title: string | undefined, actions: Action[]) => openSheet(() => <ActionSheet title={title} actions={actions} />), [openSheet])
}

/** Ask before deleting. */
export function useConfirmDelete() {
  const show = useActionSheet()
  return useCallback(
    (what: string, onDelete: () => void) => show(`Delete ${what}? This can't be undone.`, [{ label: `Delete ${what}`, destructive: true, onPress: onDelete }]),
    [show],
  )
}
