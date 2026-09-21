// Supabase Edge Function: scoreZones
// Runs on a 15-minute cron schedule via pg_cron or HTTP invocation.
// Analyzes flags from the last 7 days per zone, applies anti-gaming burst checks,
// computes zone risk score, and writes alerts when score >= 55.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Flag {
  id: string
  zone_id: string
  category: string
  reporter_hash: string
  created_at: string
  repeat: boolean
}

function detectBurst(rs: Flag[]): Flag[] {
  // A burst: >= 5 flags within 20 minutes from overlapping reporter hashes
  const sorted = [...rs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  for (let i = 0; i < sorted.length; i++) {
    const t0 = new Date(sorted[i].created_at).getTime()
    const win = sorted.filter((r) => {
      const t = new Date(r.created_at).getTime()
      return t >= t0 && t - t0 <= 20 * 60_000
    })
    const uniqueReporters = new Set(win.map((r) => r.reporter_hash)).size
    if (win.length >= 5 && uniqueReporters <= win.length / 2) return win
  }
  return []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment. scoreZones requires service-role privileges to write to zones and alerts.')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1. Fetch zones
    const { data: zones, error: zoneErr } = await supabase.from('zones').select('id, name, slug')
    if (zoneErr) throw zoneErr

    // 2. Fetch flags from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
    const { data: flags, error: flagErr } = await supabase
      .from('flags')
      .select('*')
      .gte('created_at', sevenDaysAgo)
    if (flagErr) throw flagErr

    const flagsByZone = new Map<string, Flag[]>()
    for (const f of (flags || []) as Flag[]) {
      const list = flagsByZone.get(f.zone_id) || []
      list.push(f)
      flagsByZone.set(f.zone_id, list)
    }

    const generatedAlerts = []

    for (const zone of zones || []) {
      const zoneFlags = flagsByZone.get(zone.id) || []
      if (zoneFlags.length < 4) {
        await supabase
          .from('zones')
          .update({ risk_score: 0, risk_level: 'normal' })
          .eq('id', zone.id)
        continue
      }

      const burst = detectBurst(zoneFlags)
      const valid = zoneFlags.filter((f) => !burst.includes(f))

      const distinct = new Set(valid.map((f) => f.reporter_hash)).size
      if (distinct < 3 || valid.length < 4) {
        await supabase
          .from('zones')
          .update({ risk_score: 0, risk_level: 'normal' })
          .eq('id', zone.id)
        continue
      }

      const catCounts = new Map<string, number>()
      valid.forEach((f) => catCounts.set(f.category, (catCounts.get(f.category) || 0) + 1))
      const [dominant, similar] = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ['other', 0]
      if (similar < 3) {
        await supabase
          .from('zones')
          .update({ risk_score: 0, risk_level: 'normal' })
          .eq('id', zone.id)
        continue
      }

      const timestamps = valid.map((f) => new Date(f.created_at).getTime())
      const first = Math.min(...timestamps)
      const last = Math.max(...timestamps)
      const windowH = (last - first) / 3600_000
      const timeSpreadDays = windowH / 24
      const repeats = valid.filter((f) => f.repeat).length

      // Formula ported unchanged from src/lib/engine.ts
      const score = Math.min(
        99,
        Math.round(
          Math.min(distinct * 6, 36) +
          (similar / valid.length) * 18 +
          (windowH <= 7 * 24 ? 10 : 4) +
          (10) + // zone proximity guaranteed by zone grouping
          Math.min(repeats * 3, 15) +
          (burst.length ? -3 : 0)
        )
      )

      // Consistent vocabulary across engine, UI, and DB:
      // 'normal' for unalerted baseline, 'Medium' (score 55-79), 'High' (score 80+)
      const risk_level = score >= 80 ? 'High' : score >= 55 ? 'Medium' : 'normal'

      // Update zone score
      await supabase
        .from('zones')
        .update({ risk_score: score, risk_level })
        .eq('id', zone.id)

      if (score >= 55) {
        const alertPayload = {
          zone_id: zone.id,
          distinct_reporters: distinct,
          time_spread_days: Math.round(timeSpreadDays * 10) / 10,
          category_diversity: catCounts.size,
          risk_score: score,
          risk_level,
          dominant_category: dominant,
          total_flags: valid.length,
        }

        const { data: newAlert, error: insErr } = await supabase
          .from('alerts')
          .insert(alertPayload)
          .select()
          .single()

        if (!insErr && newAlert) {
          generatedAlerts.push(newAlert)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        evaluatedZones: zones?.length ?? 0,
        alertsCreated: generatedAlerts.length,
        alerts: generatedAlerts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
