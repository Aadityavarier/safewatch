// SafeWatch API layer — all Supabase calls live here.
// No mock/fallback paths. All functions throw ApiError on failure.

import { supabase } from './supabaseClient'
import { getReporterHash } from './identity'
import { PLACES, type Category, type Report, type ReportStatus } from './types'

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
  created_at: string
  zones?: { name: string; slug: string; zone: string }
}
export interface CommentRow {
  id: string; post_id: string; reporter_hash: string; body: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function flagRowToReport(row: FlagRow, zoneMap: Map<string, ZoneRow>): Report {
  const zone = zoneMap.get(row.zone_id)
  const place = zone ? PLACES.find((p) => p.id === zone.slug) : null
  const { x, y } = zone ? latLngToXY(zone.lat, zone.lng) : (place ?? { x: 500, y: 320 })
  const status: ReportStatus = 'received'
  return {
    id: row.id,
    cats: [row.category as Category],
    placeId: zone?.slug ?? row.zone_id,
    x: x + (Math.random() - 0.5) * 40, // small jitter like original mock
    y: y + (Math.random() - 0.5) * 40,
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

// ─── Zones ─────────────────────────────────────────────────────────────────────
export async function getZones(): Promise<ZoneRow[]> {
  const sb = assertSB()
  const { data, error } = await sb.from('zones').select('*').order('name')
  if (error) throw new ApiError('getZones failed', error)
  return data as ZoneRow[]
}

// ─── Flags ─────────────────────────────────────────────────────────────────────
export async function getAllFlags(limitHours = 168): Promise<{ flags: FlagRow[]; zones: ZoneRow[] }> {
  const sb = assertSB()
  const since = new Date(Date.now() - limitHours * 3600_000).toISOString()
  const [flagsRes, zonesRes] = await Promise.all([
    sb.from('flags').select('*').gte('created_at', since).order('created_at', { ascending: false }),
    sb.from('zones').select('*'),
  ])
  if (flagsRes.error) throw new ApiError('getAllFlags failed', flagsRes.error)
  if (zonesRes.error) throw new ApiError('getZones (in getAllFlags) failed', zonesRes.error)
  return { flags: flagsRes.data as FlagRow[], zones: zonesRes.data as ZoneRow[] }
}

export async function getAllFlagsAsReports(limitHours = 168): Promise<Report[]> {
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
  zoneId: string
  category: Category
  description?: string
  repeat?: boolean
  people?: string
  direction?: string
}

export async function submitFlag(params: SubmitFlagParams): Promise<FlagRow> {
  const sb = assertSB()
  const reporterHash = await getReporterHash()
  const { data, error } = await sb.from('flags').insert({
    zone_id: params.zoneId,
    category: params.category,
    reporter_hash: reporterHash,
    description: params.description ?? '',
    repeat: params.repeat ?? false,
    people: params.people ?? '',
    direction: params.direction ?? '',
  }).select().single()
  if (error) throw new ApiError('submitFlag failed', error)
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
  let q = sb.from('posts').select('*, zones(name, slug, zone)')
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
  const { data, error } = await sb.from('posts').select('*, zones(name, slug, zone)').eq('id', id).single()
  if (error) throw new ApiError('getPost failed', error)
  return data as PostRow
}

export async function submitPost(zoneId: string, body: string, photoFile?: File): Promise<PostRow> {
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
  }).select('*, zones(name, slug, zone)').single()
  if (error) throw new ApiError('submitPost failed', error)
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

export async function submitComment(postId: string, body: string): Promise<CommentRow> {
  const sb = assertSB()
  const reporterHash = await getReporterHash()
  const { data, error } = await sb.from('comments').insert({
    post_id: postId,
    reporter_hash: reporterHash,
    body,
  }).select().single()
  if (error) throw new ApiError('submitComment failed', error)
  return data as CommentRow
}
