/** Optional 4-digit PIN lock. Stored per phone, as a hash, never synced. */
const KEY = 'ht:pin'

async function hash(pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('house-tracker:' + pin))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(KEY)
  } catch {
    return false
  }
}

export async function setPin(pin: string) {
  localStorage.setItem(KEY, await hash(pin))
}

export function clearPin() {
  localStorage.removeItem(KEY)
}

export async function checkPin(pin: string): Promise<boolean> {
  return (await hash(pin)) === localStorage.getItem(KEY)
}
