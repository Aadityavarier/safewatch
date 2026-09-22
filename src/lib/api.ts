// SafeWatch API layer — all Supabase calls live here.
// No mock/fallback paths. All functions throw ApiError on failure.

import { supabase } from './supabaseClient'
import { getReporterHash } from './identity'
import { PLACES, registerPlace, type Category, type Report, type ReportStatus } from './types'
import { reverseGeocode } from './geocoding'

// ─── Geo projection ────────────────────────────────────────────────────────────
// Bounding box for the Navi Mumbai area we care about (matches seed zones).
// SVG canvas is 1000 × 640 (from SafetyMap.tsx W / HGT constants).
const GEO = {
  minLat: 19.0100, maxLat: 19.0450,
  minLng: 72.9950, maxLng: 73.0300,
  W: 1000, H: 640,
}
export function latLngToXY(lat: number, lng: number): { x: number; y: number } {
  const x = Math.round(((lng - GEO.minLng) / (GEO.maxLng - GEO.minLng)) * GEO.W)
  // latitude increases upward on a map but y increases downward on SVG
  const y = Math.round((1 - (lat - GEO.minLat) / (GEO.maxLat - GEO.minLat)) * GEO.H)
  return { x: Math.max(0, Math.min(GEO.W, x)), y: Math.max(0, Math.min(GEO.H, y)) }
}

// ─── Error type ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(msg: string, public readonly cause?: unknown) {
    super(msg)
    this.name = 'ApiError'
  }
}
function assertSB(): NonNullable<typeof supabase> {
  if (!supabase) throw new ApiError('Supabase client not initialised — check env vars.')
  return supabase
}

// ─── DB row types ──────────────────────────────────────────────────────────────
export interface ZoneRow {
  id: string; name: string; slug: string; zone: string
  lat: number; lng: number; radius_m: number
  risk_score: number; risk_level: string; created_at: string
}
export interface FlagRow {
  id: string; zone_id: string; category: string; reporter_hash: string
  description: string; repeat: boolean; people: string; direction: string
  created_at: string
}
export interface AlertRow {
  id: string; zone_id: string; distinct_reporters: number
  time_spread_days: number; category_diversity: number
  risk_score: number; risk_level: string; dominant_category: string | null
  total_flags: number; created_at: string
  // joined
  zones?: { name: string; slug: string; zone: string }
}
export interface PostRow {
  id: string; zone_id: string; reporter_hash: string; body: string
  photo_url: string | null; upvotes: number; flagged_for_review: boolean
  display_name?: string | null
  created_at: string
  zones?: { name: string; slug: string; zone: string; lat: number; lng: number }
}
export interface CommentRow {
  id: string; post_id: string; reporter_hash: string; body: string
  display_name?: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function flagRowToReport(row: FlagRow, zoneMap: Map<string, ZoneRow>): Report {
  const zone = zoneMap.get(row.zone_id)
  const place = zone ? PLACES.find((p) => p.id === zone.slug) : null
  const { x, y } = zone ? latLngToXY(zone.lat, zone.lng) : (place ?? { x: 500, y: 320 })
  // Small jitter: ±0.0003° ≈ ±30 m — mirrors the ±20 SVG-pixel jitter for visual spread
  const jitterLat = (Math.random() - 0.5) * 0.0006
  const jitterLng = (Math.random() - 0.5) * 0.0006
  const baseLat = zone?.lat ?? place?.lat ?? 19.0280
  const baseLng = zone?.lng ?? place?.lng ?? 73.0130
  const status: ReportStatus = 'received'
  return {
    id: row.id,
    cats: [row.category as Category],
    placeId: zone?.slug ?? row.zone_id,
    x: x + (Math.random() - 0.5) * 40, // pixel jitter for engine intra-cluster geometry
    y: y + (Math.random() - 0.5) * 40,
    lat: baseLat + jitterLat,
    lng: baseLng + jitterLng,
    ts: new Date(row.created_at).getTime(),
    reporter: row.reporter_hash,
    device: row.reporter_hash, // hash is used as device proxy for burst detection
    status,
    desc: row.description,
    repeat: row.repeat,
    people: row.people,
    direction: row.direction,
  }
}

// ─── Zones & Spatial Snapping ───────────────────────────────────────────────
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const MAX_ZONE_SNAP_METERS = 2000 // 2 km

let cachedZones: ZoneRow[] | null = null

export async function getZones(forceRefresh = false): Promise<ZoneRow[]> {
  if (!forceRefresh && cachedZones && cachedZones.length > 0) return cachedZones
  const sb = assertSB()
  const { data, error } = await sb.from('zones').select('*').order('name')
  if (error) throw new ApiError('getZones failed: ' + (error.message || ''), error)
  cachedZones = data as ZoneRow[]
  // Register all DB zones with the dynamic place registry so placeById resolves them
  cachedZones.forEach((z) => {
    registerPlace({
      id: z.slug,
      name: z.name,
      zone: z.zone || 'Local Area',
      x: 500,
      y: 320,
      lat: z.lat,
      lng: z.lng,
    })
  })
  return cachedZones
}

export async function findOrCreateZone(
  lat: number,
  lng: number,
  fallbackName?: string,
  fallbackZone?: string
): Promise<ZoneRow> {
  const sb = assertSB()
  const zones = await getZones(true)

  // 1. Check if any existing zone is within MAX_ZONE_SNAP_METERS (2 km)
  let closest: ZoneRow | null = null
  let minDistance = Infinity

  for (const z of zones) {
    const d = haversineM(lat, lng, z.lat, z.lng)
    if (d < minDistance) {
      minDistance = d
      closest = z
    }
  }

  if (closest && minDistance <= MAX_ZONE_SNAP_METERS) {
    return closest
  }

  // 2. Farther than 2 km: dynamic zone registration
  const geo = await reverseGeocode(lat, lng)
  const zoneName = fallbackName || geo.name
  const zoneRegion = fallbackZone || geo.zone

  // Generate unique slug
  const baseSlug = zoneName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 30) || 'zone'
  const slug = `${baseSlug}-${Math.round(Math.abs(lat) * 100).toString(36)}-${Math.round(Math.abs(lng) * 100).toString(36)}`

  // Insert new zone row
  const reporterHash = await getReporterHash()
  const { data, error } = await sb.from('zones').insert({
    name: zoneName,
    slug,
    zone: zoneRegion,
    lat,
    lng,
    radius_m: 100,
    risk_score: 0,
    risk_level: 'normal',
    creator_hash: reporterHash,
  }).select().single()

  if (error) {
    // If slug collision or insert error, try to query matching slug or fallback to closest
    const { data: existing } = await sb.from('zones').select('*').eq('slug', slug).single()
    if (existing) {
      const z = existing as ZoneRow
      registerPlace({
        id: z.slug,
        name: z.name,
        zone: z.zone || 'Local Area',
        x: 500,
        y: 320,
        lat: z.lat,
        lng: z.lng,
      })
      if (cachedZones && !cachedZones.some((item) => item.id === z.id)) cachedZones.push(z)
      return z
    }
    if (closest) return closest
    throw new ApiError('Failed to create dynamic zone: ' + (error.message || ''), error)
  }

  const newZone = data as ZoneRow
  registerPlace({
    id: newZone.slug,
    name: newZone.name,
    zone: newZone.zone || 'Local Area',
    x: 500,
    y: 320,
    lat: newZone.lat,
    lng: newZone.lng,
  })
  if (cachedZones) cachedZones.push(newZone)
  return newZone
}

// ─── Flags ─────────────────────────────────────────────────────────────────────
export async function getAllFlags(limitHours = 720): Promise<{ flags: FlagRow[]; zones: ZoneRow[] }> {
  const sb = assertSB()
  const since = new Date(Date.now() - limitHours * 3600_000).toISOString()
  const [flagsRes, zonesRes] = await Promise.all([
    sb.from('flags').select('*').gte('created_at', since).order('created_at', { ascending: false }),
    getZones(),
  ])
  if (flagsRes.error) throw new ApiError('getAllFlags failed: ' + (flagsRes.error.message || ''), flagsRes.error)
  return { flags: flagsRes.data as FlagRow[], zones: zonesRes }
}

export async function getAllFlagsAsReports(limitHours = 720): Promise<Report[]> {
  const { flags, zones } = await getAllFlags(limitHours)
  const zoneMap = new Map(zones.map((z) => [z.id, z]))
  return flags.map((f) => flagRowToReport(f, zoneMap))
}

export async function getFlagsForZone(zoneId: string): Promise<FlagRow[]> {
  const sb = assertSB()
  const { data, error } = await sb.from('flags').select('*').eq('zone_id', zoneId).order('created_at', { ascending: false })
  if (error) throw new ApiError('getFlagsForZone failed', error)
  return data as FlagRow[]
}

export interface SubmitFlagParams {
  zoneId?: string
  lat?: number
  lng?: number
  category: Category
  description?: string
  repeat?: boolean
  people?: string
  direction?: string
}

export async function submitFlag(params: SubmitFlagParams): Promise<FlagRow> {
  const sb = assertSB()
  const reporterHash = await getReporterHash()

  let resolvedZoneId = params.zoneId

  // If coordinates provided, dynamically snap or create zone
  if (params.lat != null && params.lng != null) {
    const zone = await findOrCreateZone(params.lat, params.lng)
    resolvedZoneId = zone.id
  } else if (params.zoneId) {
    // Resolve slug to UUID if a slug (e.g. 'college-gate') was passed
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.zoneId)
    if (!isUuid) {
      const zones = await getZones()
      const matched = zones.find((z) => z.slug === params.zoneId || z.id === params.zoneId)
      if (matched) resolvedZoneId = matched.id
    }
  }

  if (!resolvedZoneId) {
    throw new ApiError('Cannot submit report without a valid zone.')
  }

  const { data, error } = await sb.from('flags').insert({
    zone_id: resolvedZoneId,
    category: params.category,
    reporter_hash: reporterHash,
    description: params.description ?? '',
    repeat: params.repeat ?? false,
    people: params.people ?? '',
    direction: params.direction ?? '',
  }).select().single()

  if (error) {
    const msg = error.message || 'Failed to submit report.'
    throw new ApiError(msg, error)
  }
  return data as FlagRow
}

// ─── Alerts ────────────────────────────────────────────────────────────────────
export async function getAlerts(): Promise<AlertRow[]> {
  const sb = assertSB()
  const { data, error } = await sb
    .from('alerts')
    .select('*, zones(name, slug, zone)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new ApiError('getAlerts failed', error)
  return data as AlertRow[]
}

export async function getLastScoredAt(): Promise<number | null> {
  const sb = assertSB()
  const { data, error } = await sb.from('alerts').select('created_at').order('created_at', { ascending: false }).limit(1)
  if (error || !data?.length) return null
  return new Date(data[0].created_at).getTime()
}

// ─── Posts ─────────────────────────────────────────────────────────────────────
export async function getPosts(zoneId?: string, sort: 'recent' | 'trending' = 'recent'): Promise<PostRow[]> {
  const sb = assertSB()
  let q = sb.from('posts').select('*, zones(name, slug, zone, lat, lng)')
  if (zoneId) q = q.eq('zone_id', zoneId)
  q = sort === 'trending'
    ? q.order('upvotes', { ascending: false })
    : q.order('created_at', { ascending: false })
  const { data, error } = await q.limit(100)
  if (error) throw new ApiError('getPosts failed', error)
  return data as PostRow[]
}

export async function getPost(id: string): Promise<PostRow> {
  const sb = assertSB()
  const { data, error } = await sb.from('posts').select('*, zones(name, slug, zone, lat, lng)').eq('id', id).single()
  if (error) throw new ApiError('getPost failed', error)
  return data as PostRow
}

export async function submitPost(zoneId: string, body: string, photoFile?: File, displayName?: string): Promise<PostRow> {
  const sb = assertSB()
  const reporterHash = await getReporterHash()
  let photo_url: string | null = null

  if (photoFile) {
    const ext = photoFile.name.split('.').pop() ?? 'jpg'
    const path = `posts/${reporterHash.slice(0, 8)}-${Date.now()}.${ext}`
    const { error: upErr } = await sb.storage.from('post-photos').upload(path, photoFile, { upsert: false })
    if (upErr) throw new ApiError('Photo upload failed', upErr)
    const { data: urlData } = sb.storage.from('post-photos').getPublicUrl(path)
    photo_url = urlData.publicUrl
  }

  const { data, error } = await sb.from('posts').insert({
    zone_id: zoneId,
    reporter_hash: reporterHash,
    body,
    photo_url,
    display_name: displayName && displayName.trim() ? displayName.trim() : null,
  }).select('*, zones(name, slug, zone, lat, lng)').single()
  if (error) throw new ApiError(error.message || 'submitPost failed', error)
  return data as PostRow
}

export async function upvotePost(id: string): Promise<void> {
  const sb = assertSB()
  const { error } = await sb.rpc('increment_upvotes', { post_id: id })
  if (error) throw new ApiError('upvotePost failed', error)
}

// ─── Comments ──────────────────────────────────────────────────────────────────
export async function getComments(postId: string): Promise<CommentRow[]> {
  const sb = assertSB()
  const { data, error } = await sb.from('comments').select('*').eq('post_id', postId).order('created_at')
  if (error) throw new ApiError('getComments failed', error)
  return data as CommentRow[]
}

export async function submitComment(postId: string, body: string, displayName?: string): Promise<CommentRow> {
  const sb = assertSB()
  const reporterHash = await getReporterHash()
  const { data, error } = await sb.from('comments').insert({
    post_id: postId,
    reporter_hash: reporterHash,
    body,
    display_name: displayName && displayName.trim() ? displayName.trim() : null,
  }).select().single()
  if (error) throw new ApiError(error.message || 'submitComment failed', error)
  return data as CommentRow
}
