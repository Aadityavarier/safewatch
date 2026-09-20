// Pattern-detection engine — runs client-side on real flag data from Supabase.
// Scoring logic is preserved exactly from the original; only imports and NOW changed.
import { type Category, type Report, PLACES, placeById, catLabel } from './types'

export type Scenario = 'normal' | 'emerging' | 'detected' | 'coordinated'
export type Strength = 'Low' | 'Medium' | 'High'
export type PatternKind = 'emerging' | 'increased' | 'repeated'
export type PatternStatus = 'new' | 'review' | 'notified' | 'patrol' | 'closed'

export const METERS_PER_UNIT = 15
const H = 3600_000
const WINDOW_H = 168 // patterns look at the last 7 days

// NOW is always the current time (not a module-level snapshot)
const NOW = () => Date.now()

export interface Anomaly {
  placeId: string
  reports: Report[]
  devices: number
  spanMin: number
}

export interface Pattern {
  id: string
  placeId: string
  place: string
  zone: string
  x: number
  y: number
  kind: PatternKind
  title: string
  dominant: Category
  reports: Report[]      // valid reports counted
  excluded: Report[]     // excluded by anomaly check
  total: number
  distinct: number
  similar: number
  geoRelated: number
  repeats: number
  windowH: number
  first: number
  last: number
  diameterM: number
  peak: string
  score: number
  strength: Strength
  recent: number
  previous: number
  perDay: { day: string; count: number }[]
}

const kindTitle: Record<PatternKind, string> = {
  emerging: 'Emerging Pattern',
  increased: 'Increased Reports',
  repeated: 'Repeated Behaviour',
}
export const kindLabel = (k: PatternKind) => kindTitle[k]

function detectBurst(rs: Report[]): Report[] {
  // A burst: ≥5 reports inside 20 minutes whose device signals overlap heavily.
  const sorted = [...rs].sort((a, b) => a.ts - b.ts)
  for (let i = 0; i < sorted.length; i++) {
    const win = sorted.filter((r) => r.ts >= sorted[i].ts && r.ts - sorted[i].ts <= 20 * 60_000)
    const devices = new Set(win.map((r) => r.device)).size
    if (win.length >= 5 && devices <= win.length / 2) return win
  }
  return []
}

const hourBand = (h: number) => {
  const s = h
  const f = (x: number) => { const hh = ((x + 11) % 12) + 1; return `${hh} ${x % 24 < 12 ? 'AM' : 'PM'}` }
  return `${f(s)} – ${f((s + 3) % 24)}`
}

export function analyse(visible: Report[]) {
  const now = NOW()
  const recent = visible.filter((r) => now - r.ts <= WINDOW_H * H)
  const patterns: Pattern[] = []
  const anomalies: Anomaly[] = []
  for (const place of PLACES) {
    const rs = recent.filter((r) => r.placeId === place.id)
    if (!rs.length) continue
    const burst = detectBurst(rs)
    if (burst.length) {
      const ts = burst.map((r) => r.ts)
      anomalies.push({ placeId: place.id, reports: burst, devices: new Set(burst.map((r) => r.device)).size, spanMin: Math.max(1, Math.round((Math.max(...ts) - Math.min(...ts)) / 60000)) })
    }
    const valid = rs.filter((r) => !burst.includes(r))
    const counts = new Map<Category, number>()
    valid.forEach((r) => r.cats.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)))
    const [dominant, similar] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['other', 0]
    const distinct = new Set(valid.map((r) => r.reporter)).size
    if (valid.length < 4 || distinct < 3 || similar < 3) continue

    const cx = valid.reduce((s, r) => s + r.x, 0) / valid.length
    const cy = valid.reduce((s, r) => s + r.y, 0) / valid.length
    const dists = valid.map((r) => Math.hypot(r.x - cx, r.y - cy))
    const geoRelated = dists.filter((d) => d <= 40).length
    const diameterM = Math.round((Math.max(...dists) * 2 * METERS_PER_UNIT) / 50) * 50
    const ts = valid.map((r) => r.ts)
    const first = Math.min(...ts), last = Math.max(...ts)
    const windowH = (last - first) / H
    const repeats = valid.filter((r) => r.repeat).length
    const hrs = valid.map((r) => new Date(r.ts).getHours())
    let best = 0, bestN = -1
    for (let h = 0; h < 24; h++) { const n = hrs.filter((x) => (x - h + 24) % 24 < 3).length; if (n > bestN) { bestN = n; best = h } }
    const peak = hourBand(best)

    const score = Math.min(99, Math.round(
      Math.min(distinct * 6, 36) + (similar / valid.length) * 18 + (windowH <= 7 * 24 ? 10 : 4) +
      (geoRelated / valid.length) * 10 + Math.min(repeats * 3, 15) + (burst.length ? -3 : 0),
    ))
    const strength: Strength = score >= 80 ? 'High' : score >= 55 ? 'Medium' : 'Low'
    const rec = valid.filter((r) => now - r.ts <= 72 * H).length
    const prev = valid.length - rec
    const kind: PatternKind = strength === 'High' ? 'emerging' : rec >= prev * 1.5 && rec >= 3 ? 'increased' : 'repeated'

    const days: { day: string; count: number }[] = []
    const d0 = new Date(first); d0.setHours(0, 0, 0, 0)
    for (let t = d0.getTime(); t <= last; t += 24 * H) {
      days.push({ day: new Date(t).toLocaleDateString('en-IN', { weekday: 'short' }), count: valid.filter((r) => r.ts >= t && r.ts < t + 24 * H).length })
    }

    patterns.push({
      id: 'PT-' + place.id, placeId: place.id, place: place.name, zone: place.zone, x: cx, y: cy, kind,
      title: `${kind === 'increased' ? 'Rise in' : 'Repeated'} ${catLabel(dominant).toLowerCase()} near ${place.name}`,
      dominant, reports: valid, excluded: burst, total: valid.length, distinct, similar, geoRelated, repeats,
      windowH, first, last, diameterM: Math.max(diameterM, 200), peak, score, strength, recent: rec, previous: prev, perDay: days,
    })
  }
  patterns.sort((a, b) => b.score - a.score)
  return { patterns, anomalies, recent }
}

export type AreaLevel = 'normal' | 'increased' | 'pattern'
export function areaStatus(placeId: string, visible: Report[], patterns: Pattern[]) {
  const now = NOW()
  const p = patterns.find((x) => x.placeId === placeId)
  const near = visible.filter((r) => r.placeId === placeId && now - r.ts <= 48 * H)
  const level: AreaLevel = p?.strength === 'High' ? 'pattern' : p ? 'increased' : 'normal'
  return { level, pattern: p, recent48: near.length, similar48: p ? near.filter((r) => r.cats.includes(p.dominant)).length : 0, place: placeById(placeId) }
}

export function funnel(p: Pattern) {
  const raw = p.total + p.excluded.length
  return [
    { label: 'Reports received', value: raw, note: 'Every submission, before any checks' },
    { label: 'Pass coordination check', value: p.total, note: 'Bursts from overlapping sources set aside' },
    { label: 'From distinct reporters', value: p.distinct, note: 'Repeat submissions from one person count once' },
    { label: 'Geographically related', value: Math.min(p.geoRelated, p.distinct), note: `Within a ~${p.diameterM} m cluster` },
    { label: 'Describe similar behaviour', value: Math.min(p.similar, p.geoRelated, p.distinct), note: catLabel(p.dominant) },
  ]
}

export const fmtAgo = (ts: number) => {
  const m = Math.round((NOW() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} day${d > 1 ? 's' : ''} ago`
}
export const fmtTime = (ts: number) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
export const fmtWindow = (h: number) => (h < 48 ? `${Math.max(1, Math.round(h))} hours` : `${Math.round(h / 24) + 1} days`)
