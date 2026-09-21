// Supabase Edge Function: geocode
// Centralized proxy for OpenStreetMap Nominatim API:
// 1. Sets genuine, unstripped server-side User-Agent header
// 2. Centralizes in-memory caching across all application clients
// 3. Protects against client-side IP bans and rate-limiting

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SERVER_CACHE = new Map<string, { data: unknown; expires: number }>()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { action, lat, lng, query } = payload
    const now = Date.now()

    if (action === 'reverse') {
      if (lat == null || lng == null) {
        return new Response(JSON.stringify({ error: 'lat and lng required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const key = `rev:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`
      const cached = SERVER_CACHE.get(key)
      if (cached && cached.expires > now) {
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SafeWatch/1.0 (community-safety-app; security@safewatch.internal)',
        },
      })

      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'Nominatim reverse error' }), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const raw = await res.json()
      const addr = raw.address || {}

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
        raw.name ||
        `Area (${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)})`

      const broaderZone =
        addr.city_district ||
        addr.city ||
        addr.county ||
        addr.state_district ||
        addr.state ||
        'Local Area'

      const result = {
        name: localName,
        zone: broaderZone,
        fullName: raw.display_name || `${localName}, ${broaderZone}`,
      }

      // Cache for 24 hours on server
      SERVER_CACHE.set(key, { data: result, expires: now + 24 * 3600 * 1000 })

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'search') {
      const q = String(query || '').trim()
      if (q.length < 2) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const key = `search:${q.toLowerCase()}`
      const cached = SERVER_CACHE.get(key)
      if (cached && cached.expires > now) {
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SafeWatch/1.0 (community-safety-app; security@safewatch.internal)',
        },
      })

      if (!res.ok) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const raw = await res.json()
      const results = Array.isArray(raw)
        ? raw.map((item: any) => ({
            label: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          }))
        : []

      // Cache for 6 hours
      SERVER_CACHE.set(key, { data: results, expires: now + 6 * 3600 * 1000 })

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
