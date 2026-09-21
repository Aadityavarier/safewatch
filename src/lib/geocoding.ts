// SafeWatch Geocoding Client
// Routes requests through the Supabase Edge Function `geocode`:
// 1. Ensures genuine server-side User-Agent header reaches Nominatim (bypassing browser header restrictions)
// 2. Centralizes multi-client caching and respects fair-use rate limits
// 3. Graceful client-side fallback if edge function is unreachable

import { supabase } from './supabaseClient'

const REVERSE_CACHE = new Map<string, { name: string; zone: string; fullName: string }>()
const SEARCH_CACHE = new Map<string, Array<{ label: string; lat: number; lng: number }>>()

export interface GeocodeResult {
  name: string
  zone: string
  fullName: string
}

export interface PlaceSearchResult {
  label: string
  lat: number
  lng: number
}

function coordKey(lat: number, lng: number): string {
  // Quantize to ~100m grid to avoid redundant requests for tiny GPS drifts
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const key = coordKey(lat, lng)
  const cached = REVERSE_CACHE.get(key)
  if (cached) return cached

  const fallback: GeocodeResult = {
    name: `Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
    zone: 'Nearby',
    fullName: `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  }

  // 1. Primary: Route via Supabase Edge Function to ensure valid server-side User-Agent
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { action: 'reverse', lat, lng },
      })
      if (!error && data && data.name) {
        const result: GeocodeResult = {
          name: data.name,
          zone: data.zone || 'Local Area',
          fullName: data.fullName || `${data.name}, ${data.zone}`,
        }
        REVERSE_CACHE.set(key, result)
        return result
      }
    } catch {
      // Fall through to client fallback
    }
  }

  // 2. Fallback: Direct Nominatim fetch
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4500)

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })
    clearTimeout(timer)

    if (!res.ok) return fallback

    const data = await res.json()
    const addr = data.address || {}

    const localName =
      addr.neighbourhood ||
      addr.suburb ||
      addr.residential ||
      addr.road ||
      addr.commercial ||
      addr.quarter ||
      addr.hamlet ||
      addr.village ||
      addr.town ||
      addr.city_district ||
      data.name ||
      `Area (${lat.toFixed(3)}, ${lng.toFixed(3)})`

    const broaderZone =
      addr.city_district ||
      addr.city ||
      addr.county ||
      addr.state_district ||
      addr.state ||
      'Local Area'

    const result: GeocodeResult = {
      name: localName,
      zone: broaderZone,
      fullName: data.display_name || `${localName}, ${broaderZone}`,
    }

    REVERSE_CACHE.set(key, result)
    return result
  } catch {
    return fallback
  }
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const cached = SEARCH_CACHE.get(q.toLowerCase())
  if (cached) return cached

  // 1. Primary: Route via Supabase Edge Function
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { action: 'search', query: q },
      })
      if (!error && Array.isArray(data)) {
        SEARCH_CACHE.set(q.toLowerCase(), data)
        return data
      }
    } catch {
      // Fall through to client fallback
    }
  }

  // 2. Fallback: Direct Nominatim fetch
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })
    clearTimeout(timer)

    if (!res.ok) return []

    const data = await res.json()
    if (!Array.isArray(data)) return []

    const results: PlaceSearchResult[] = data.map((item: any) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }))

    SEARCH_CACHE.set(q.toLowerCase(), results)
    return results
  } catch {
    return []
  }
}
