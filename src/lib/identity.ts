// Anonymous reporter identity — generated once per browser, rotated weekly.
// The raw UUID is never sent to the server; only reporter_hash is.
//
// Production note: weekly_salt should be generated and rotated server-side
// so the salt is never predictable from the client. For this implementation
// the salt is derived client-side from the ISO week string (YYYY-Www).

const STORAGE_KEY = 'sw-reporter-uuid'

function getOrCreateUUID(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

function isoWeek(): string {
  const d = new Date()
  // ISO week: YYYY-Www
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

async function sha256(message: string): Promise<string> {
  const encoded = new TextEncoder().encode(message)
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

let _cachedHash: string | null = null
let _cachedWeek: string | null = null

export async function getReporterHash(): Promise<string> {
  const week = isoWeek()
  if (_cachedHash && _cachedWeek === week) return _cachedHash
  const uuid = getOrCreateUUID()
  _cachedHash = await sha256(uuid + week)
  _cachedWeek = week
  return _cachedHash
}

// Sync version — returns the cached hash ('' if not yet computed).
// Call getReporterHash() first at app boot to warm the cache.
export function getReporterHashSync(): string {
  return _cachedHash ?? ''
}
