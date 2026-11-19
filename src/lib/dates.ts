const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today(): string {
  return toISODate(new Date())
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function daysBetween(a: Date, b: Date): number {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
    new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  return Math.round(ms / 86400000)
}

/** Start of the week containing d, where weekStartsOn is 0 (Sun) .. 6 (Sat). */
export function weekStart(d: Date, weekStartsOn: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (r.getDay() - weekStartsOn + 7) % 7
  return addDays(r, -diff)
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function fmtDate(s: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const d = typeof s === 'string' ? parseISODate(s) : s
  return d.toLocaleDateString('en-GB', opts)
}

export function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function relativeDay(s: string): string {
  const diff = daysBetween(new Date(), parseISODate(s))
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  const d = parseISODate(s)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return fmtDate(s, sameYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

export function sameMonth(s: string, ref: Date): boolean {
  const d = parseISODate(s)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthFromKey(k: string): Date {
  const [y, m] = k.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function fmtMonthShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'short' })
}
