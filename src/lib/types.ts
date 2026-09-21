// Canonical types shared across the whole app.
// This file replaces src/data/mockReports.ts — all shapes are preserved exactly.

export type Category =
  | 'catcalling' | 'harassment' | 'following' | 'loitering'
  | 'suspicious' | 'stalking' | 'unsafe_location' | 'other'

export const CATEGORIES: { id: Category; label: string; hint: string }[] = [
  { id: 'catcalling', label: 'Catcalling', hint: 'Whistles, comments, remarks' },
  { id: 'harassment', label: 'Harassment', hint: 'Unwanted contact or intimidation' },
  { id: 'following', label: 'Following', hint: 'Someone trailing you' },
  { id: 'loitering', label: 'Loitering', hint: 'Repeatedly waiting around' },
  { id: 'suspicious', label: 'Suspicious Behaviour', hint: 'Something felt off' },
  { id: 'stalking', label: 'Stalking', hint: 'Repeated, targeted presence' },
  { id: 'unsafe_location', label: 'Unsafe Location', hint: 'Dark, deserted, broken lights' },
  { id: 'other', label: 'Other', hint: 'Anything else concerning' },
]
export const catLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label ?? c

export type ReportStatus = 'received' | 'review' | 'contributed' | 'closed'

// Place has both SVG canvas coords (kept for engine intra-zone spread) and real lat/lng for Leaflet rendering.
export interface Place { id: string; name: string; zone: string; x: number; y: number; lat: number; lng: number }

// Reference zone list — kept in sync with supabase zones table.
// SVG x/y are derived from the 1000×640 projection (used by engine for intra-cluster geometry).
// Real lat/lng are used by Leaflet rendering and haversine distance calculations.
export const PLACES: Place[] = [
  { id: 'college-gate',    name: 'College Gate',         zone: 'North Campus',  x: 318, y: 196, lat: 19.0320, lng: 73.0095 },
  { id: 'station-road',    name: 'Station Road',          zone: 'Sector 3',      x: 640, y: 318, lat: 19.0260, lng: 73.0190 },
  { id: 'market-entrance', name: 'Market Entrance',       zone: 'Old Market',    x: 470, y: 452, lat: 19.0195, lng: 73.0130 },
  { id: 'hostel-road',     name: 'Hostel Road',           zone: 'South Campus',  x: 212, y: 404, lat: 19.0215, lng: 73.0055 },
  { id: 'bus-underpass',   name: 'Bus Depot Underpass',   zone: 'Sector 5',      x: 812, y: 180, lat: 19.0325, lng: 73.0245 },
  { id: 'library-lane',    name: 'Library Lane',          zone: 'North Campus',  x: 402, y: 126, lat: 19.0355, lng: 73.0115 },
  { id: 'metro-exit',      name: 'Metro Exit B',          zone: 'Sector 3',      x: 736, y: 420, lat: 19.0210, lng: 73.0220 },
  { id: 'lake-promenade',  name: 'Lake Promenade',        zone: 'Waterfront',    x: 116, y: 560, lat: 19.0145, lng: 73.0010 },
  { id: 'tuition-hub',     name: 'Tuition Hub Lane',      zone: 'Sector 7',      x: 574, y: 142, lat: 19.0345, lng: 73.0165 },
  { id: 'park-street',     name: 'Park Street',           zone: 'Sector 8',      x: 900, y: 520, lat: 19.0165, lng: 73.0280 },
]
const DYNAMIC_PLACES = new Map<string, Place>()

export function registerPlace(p: Place) {
  DYNAMIC_PLACES.set(p.id, p)
}

export const placeById = (id: string): Place => {
  return PLACES.find((p) => p.id === id) || DYNAMIC_PLACES.get(id) || {
    id,
    name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    zone: 'Local Area',
    x: 500,
    y: 320,
    lat: 19.0270,
    lng: 73.0120,
  }
}

// Report shape — identical to what components expect. Flags from Supabase are
// mapped to this shape in api.ts before being handed to the store/engine.
export interface Report {
  id: string
  cats: Category[]
  placeId: string
  x: number         // projected from real lat/lng in api.ts — used by engine intra-cluster geometry
  y: number         // projected from real lat/lng in api.ts — used by engine intra-cluster geometry
  lat: number       // real geographic latitude — used by Leaflet rendering
  lng: number       // real geographic longitude — used by Leaflet rendering
  ts: number        // millisecond timestamp
  reporter: string  // = reporter_hash (anonymous token)
  device: string    // = reporter_hash (used only for burst detection; we use hash as proxy)
  status: ReportStatus
  desc: string
  repeat?: boolean
  people?: string
  direction?: string
  mine?: boolean
  anonymous?: boolean
  hasMedia?: boolean
}

// NOW is live real time, not a fixed module-level snapshot.
export const NOW = Date.now
