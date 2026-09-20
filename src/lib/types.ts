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

// Place uses the synthetic SVG canvas (1000×640). Real lat/lng lives in the zones
// table; api.ts projects lat/lng → x/y before returning data to components.
export interface Place { id: string; name: string; zone: string; x: number; y: number }

// Reference zone list — kept in sync with supabase/seed.sql via the x/y projection
// in api.ts (latLngToXY). Names/IDs here must match zone names in the DB.
export const PLACES: Place[] = [
  { id: 'college-gate',    name: 'College Gate',         zone: 'North Campus',  x: 318, y: 196 },
  { id: 'station-road',    name: 'Station Road',          zone: 'Sector 3',      x: 640, y: 318 },
  { id: 'market-entrance', name: 'Market Entrance',       zone: 'Old Market',    x: 470, y: 452 },
  { id: 'hostel-road',     name: 'Hostel Road',           zone: 'South Campus',  x: 212, y: 404 },
  { id: 'bus-underpass',   name: 'Bus Depot Underpass',   zone: 'Sector 5',      x: 812, y: 180 },
  { id: 'library-lane',   name: 'Library Lane',           zone: 'North Campus',  x: 402, y: 126 },
  { id: 'metro-exit',     name: 'Metro Exit B',           zone: 'Sector 3',      x: 736, y: 420 },
  { id: 'lake-promenade', name: 'Lake Promenade',         zone: 'Waterfront',    x: 116, y: 560 },
  { id: 'tuition-hub',    name: 'Tuition Hub Lane',       zone: 'Sector 7',      x: 574, y: 142 },
  { id: 'park-street',    name: 'Park Street',            zone: 'Sector 8',      x: 900, y: 520 },
]
export const placeById = (id: string) => PLACES.find((p) => p.id === id)!

// Report shape — identical to what components expect. Flags from Supabase are
// mapped to this shape in api.ts before being handed to the store/engine.
export interface Report {
  id: string
  cats: Category[]
  placeId: string
  x: number         // projected from real lat/lng in api.ts
  y: number         // projected from real lat/lng in api.ts
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
  // scenario field removed — was only used for mock demo-mode filtering
}

// NOW is live real time, not a fixed module-level snapshot.
export const NOW = Date.now
