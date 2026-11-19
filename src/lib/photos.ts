/**
 * Photos are compressed on the phone, kept in IndexedDB (so they show offline),
 * and uploaded to the private Supabase "photos" bucket when online.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getState, onAfterFlush, remove, save } from './store'
import type { Photo, PhotoKind } from './types'
import { today } from './dates'

const DB = 'ht-photos'
let dbp: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('blobs')
        req.result.createObjectStore('pending')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode)
    const r = fn(t.objectStore(store))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

const getBlob = (id: string) => tx<Blob | undefined>('blobs', 'readonly', (s) => s.get(id))
const putBlob = (id: string, b: Blob) => tx('blobs', 'readwrite', (s) => s.put(b, id))
const delBlob = (id: string) => tx('blobs', 'readwrite', (s) => s.delete(id))

/** Resize to max 1600px and re-encode as JPEG (~150–300 KB). */
export async function compress(file: File, max = 1600, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null)
  let w: number, h: number, src: CanvasImageSource
  if (bmp) {
    w = bmp.width
    h = bmp.height
    src = bmp
  } else {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await img.decode()
    w = img.naturalWidth
    h = img.naturalHeight
    src = img
  }
  const scale = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality))
}

export async function addPhoto(
  file: File,
  meta: { kind: PhotoKind; ref_id?: string | null; area_id?: string | null; title?: string | null; date?: string },
): Promise<Photo> {
  const { householdId } = getState()
  if (!householdId) throw new Error('No household')
  const id = crypto.randomUUID()
  const blob = await compress(file)
  const path = `${householdId}/${id}.jpg`
  await putBlob(id, blob)
  await tx('pending', 'readwrite', (s) => s.put({ id, path }, id))
  const photo = save('photos', {
    id,
    path,
    kind: meta.kind,
    ref_id: meta.ref_id ?? null,
    area_id: meta.area_id ?? null,
    title: meta.title ?? null,
    date: meta.date || today(),
  })
  uploadPending()
  return photo
}

export function deletePhoto(p: Photo) {
  remove('photos', p.id)
  delBlob(p.id).catch(() => undefined)
  tx('pending', 'readwrite', (s) => s.delete(p.id)).catch(() => undefined)
  supabase.storage.from('photos').remove([p.path]).catch(() => undefined)
}

let uploading = false
export async function uploadPending() {
  if (uploading || !navigator.onLine) return
  uploading = true
  try {
    const items = await tx<{ id: string; path: string }[]>('pending', 'readonly', (s) => s.getAll())
    for (const it of items) {
      const blob = await getBlob(it.id)
      if (!blob) {
        await tx('pending', 'readwrite', (s) => s.delete(it.id))
        continue
      }
      const { error } = await supabase.storage
        .from('photos')
        .upload(it.path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error && !/exists/i.test(error.message)) break
      await tx('pending', 'readwrite', (s) => s.delete(it.id))
    }
  } finally {
    uploading = false
  }
}
onAfterFlush(uploadPending)

const urlCache = new Map<string, string>()

export function usePhotoUrl(photo: Pick<Photo, 'id' | 'path'> | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(photo ? urlCache.get(photo.id) || null : null)
  useEffect(() => {
    if (!photo) return
    const cached = urlCache.get(photo.id)
    if (cached) {
      setUrl(cached)
      return
    }
    let alive = true
    ;(async () => {
      let blob = await getBlob(photo.id).catch(() => undefined)
      if (!blob && navigator.onLine) {
        const { data } = await supabase.storage.from('photos').download(photo.path)
        if (data) {
          blob = data
          putBlob(photo.id, data).catch(() => undefined)
        }
      }
      if (blob && alive) {
        const u = URL.createObjectURL(blob)
        urlCache.set(photo.id, u)
        setUrl(u)
      }
    })()
    return () => {
      alive = false
    }
  }, [photo?.id, photo?.path])
  return url
}
