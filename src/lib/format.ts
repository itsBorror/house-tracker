const nf3 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** "1,250.000 DT". Use short for big dashboard numbers: "1,250 DT". */
export function dt(n: number | null | undefined, opts: { short?: boolean } = {}): string {
  const v = Number(n) || 0
  return `${opts.short ? nf0.format(Math.round(v)) : nf3.format(v)} DT`
}

export function num(n: number, short = false): string {
  return short ? nf0.format(Math.round(n)) : nf3.format(n)
}

/** Parse what the user typed. Accepts "1 200,5", "1,200.5" or "1200.500". */
export function parseAmount(s: string): number | null {
  if (!s) return null
  let t = s.replace(/[\s ]/g, '')
  if (t.includes(',') && !t.includes('.')) {
    // "1,200" is thousands; "1200,5" uses a decimal comma
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.')
  }
  t = t.replace(/,/g, '')
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null
}

export function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((a, r) => a + (Number(pick(r)) || 0), 0)
}

export function pct(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0
  return Math.max(0, Math.min(100, (part / whole) * 100))
}
