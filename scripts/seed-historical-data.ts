import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://newirytyjkwuxrwggncz.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const CATEGORIES = [
  'catcalling',
  'harassment',
  'following',
  'loitering',
  'suspicious',
  'stalking',
  'unsafe_location',
  'other',
]

interface ZoneRow {
  id: string
  name: string
  slug: string
  zone: string
}

async function seedHistoricalData() {
  console.log('🌱 Starting 30-day historical data seeding...')

  // 1. Fetch zones
  const { data: zones, error: zErr } = await supabase.from('zones').select('id, name, slug, zone')
  if (zErr || !zones || zones.length === 0) {
    throw new Error(`Failed to load zones: ${zErr?.message}`)
  }
  console.log(`Found ${zones.length} zones in database.`)

  const zoneMap = new Map<string, ZoneRow>()
  zones.forEach((z) => zoneMap.set(z.slug, z))

  const collegeGate = zoneMap.get('college-gate') || zones[0]
  const parkStreet = zoneMap.get('park-street') || zones[1]
  const marketRoad = zoneMap.get('market-road') || zones[2]

  const flagsToInsert: Array<{
    zone_id: string
    category: string
    reporter_hash: string
    description: string
    repeat: boolean
    people: string
    direction: string
    created_at: string
  }> = []

  const now = Date.now()
  const H = 3600_000
  const D = 24 * H

  // 2. Cluster in College Gate (last 36 hours): 6 reports from distinct reporters
  // This ensures scoreZones triggers an emerging alert for College Gate
  const cgCats = ['catcalling', 'catcalling', 'harassment', 'catcalling', 'following', 'suspicious']
  const cgHours = [2, 5, 11, 18, 26, 34]
  cgCats.forEach((cat, idx) => {
    const ts = new Date(now - cgHours[idx] * H).toISOString()
    flagsToInsert.push({
      zone_id: collegeGate.id,
      category: cat,
      reporter_hash: `rep-cg-recent-${idx}-${now}`,
      description: `Observed near gate exit. Group loitering by the curb.`,
      repeat: idx % 2 === 1,
      people: '2-3',
      direction: 'Stayed in place',
      created_at: ts,
    })
  })

  // 3. Cluster in Park Street (last 3-5 days): 4 reports
  const psCats = ['unsafe_location', 'loitering', 'unsafe_location', 'suspicious']
  const psDays = [2.5, 3.2, 4.1, 4.8]
  psCats.forEach((cat, idx) => {
    const ts = new Date(now - psDays[idx] * D).toISOString()
    flagsToInsert.push({
      zone_id: parkStreet.id,
      category: cat,
      reporter_hash: `rep-ps-hist-${idx}-${now}`,
      description: `Poor street lighting and isolated stretch after 8 PM.`,
      repeat: false,
      people: idx === 1 ? '1' : '',
      direction: 'Towards main road',
      created_at: ts,
    })
  })

  // 4. Cluster in Market Road (last 5-8 days): 4 reports
  const mrCats = ['harassment', 'following', 'harassment', 'catcalling']
  const mrDays = [5.5, 6.2, 7.0, 7.8]
  mrCats.forEach((cat, idx) => {
    const ts = new Date(now - mrDays[idx] * D).toISOString()
    flagsToInsert.push({
      zone_id: marketRoad.id,
      category: cat,
      reporter_hash: `rep-mr-hist-${idx}-${now}`,
      description: `Crowded market corner near bus stop.`,
      repeat: true,
      people: '1',
      direction: 'Towards station',
      created_at: ts,
    })
  })

  // 5. Distributed background reports across the 30-day window (days 8-29)
  let counter = 0
  for (let day = 8; day < 30; day++) {
    const reportsForDay = (day % 3 === 0) ? 2 : 1
    for (let r = 0; r < reportsForDay; r++) {
      counter++
      const targetZone = zones[(day + r) % zones.length]
      const targetCat = CATEGORIES[(day * 3 + r) % CATEGORIES.length]
      const hourOffset = 18 + (counter % 5)
      const date = new Date(now - day * D)
      date.setHours(hourOffset, (counter * 17) % 60, 0, 0)

      flagsToInsert.push({
        zone_id: targetZone.id,
        category: targetCat,
        reporter_hash: `rep-hist-d${day}-${r}-${now}`,
        description: `Community observation reported at ${targetZone.name}.`,
        repeat: counter % 4 === 0,
        people: counter % 2 === 0 ? '1' : '2',
        direction: 'Towards campus',
        created_at: date.toISOString(),
      })
    }
  }

  console.log(`Generated ${flagsToInsert.length} total realistic flags spanning 30 days.`)

  const batchSize = 25
  let inserted = 0
  for (let i = 0; i < flagsToInsert.length; i += batchSize) {
    const chunk = flagsToInsert.slice(i, i + batchSize)
    const { error: fErr } = await supabase.from('flags').insert(chunk)
    if (fErr) {
      console.error(`Batch insert error at chunk ${i}:`, fErr)
      throw fErr
    }
    inserted += chunk.length
    console.log(`  Inserted ${inserted}/${flagsToInsert.length} flags...`)
  }

  console.log(`✅ Successfully seeded ${inserted} flags!`)

  // 6. Invoke scoreZones Edge Function
  console.log('\n🤖 Invoking scoreZones Edge Function...')
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scoreZones`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    const scoreResult = await res.json()
    console.log('scoreZones response:', JSON.stringify(scoreResult, null, 2))
  } catch (err) {
    console.warn('Could not trigger scoreZones via HTTP:', err)
  }

  // 7. Inspect generated alerts
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, zone_id, risk_level, risk_score, distinct_reporters, dominant_category, total_flags, zones(name)')
    .order('created_at', { ascending: false })

  console.log('\n🚨 Live alerts in database:')
  if (alerts && alerts.length > 0) {
    alerts.forEach((a) => {
      console.log(`  - [${a.risk_level.toUpperCase()}] ${a.zones?.name || a.zone_id}: Score ${a.risk_score} (${a.total_flags} flags, ${a.distinct_reporters} reporters, ${a.dominant_category})`)
    })
  } else {
    console.log('  (No alerts generated yet)')
  }

  // 8. Inspect updated zone risk levels
  const { data: scoredZones } = await supabase
    .from('zones')
    .select('name, risk_level, risk_score')
    .order('risk_score', { ascending: false })

  console.log('\n📍 Zone risk levels:')
  scoredZones?.slice(0, 5).forEach((z) => {
    console.log(`  - ${z.name}: ${z.risk_level} (score: ${z.risk_score})`)
  })

  console.log('\n🎉 Historical data seeding and scoring complete.')
}

seedHistoricalData().catch((err) => {
  console.error('Seeding failed:', err)
  process.exit(1)
})

