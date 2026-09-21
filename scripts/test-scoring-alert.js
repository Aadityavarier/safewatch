import { createClient } from '@supabase/supabase-js'

const url = 'https://newirytyjkwuxrwggncz.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'
const supabase = createClient(url, anonKey)

async function testThresholdScoring() {
  console.log('\n--- Testing End-to-End Scoring Cycle & Alert Generation ---')

  // 1. Get College Gate zone
  const { data: zone, error: zErr } = await supabase.from('zones').select('*').eq('slug', 'college-gate').single()
  if (zErr || !zone) {
    console.error('Failed to find college-gate zone:', zErr)
    return
  }

  console.log(`Target zone: ${zone.name} (${zone.id})`)

  // 2. Insert 5 distinct flags spaced out slightly (legitimate pattern, distinct reporters)
  const flagIds = []
  for (let i = 1; i <= 5; i++) {
    const { data: flag, error: fErr } = await supabase.from('flags').insert({
      zone_id: zone.id,
      category: 'catcalling',
      reporter_hash: `distinct-reporter-hash-${i}-${Date.now()}`,
      description: `E2E pattern test submission ${i}`,
      repeat: i % 2 === 0,
    }).select().single()

    if (fErr) {
      console.error(`Failed to insert flag ${i}:`, fErr)
    } else {
      flagIds.push(flag.id)
    }
  }
  console.log(`Inserted ${flagIds.length} distinct reports into ${zone.name}`)

  // 3. Trigger scoreZones
  console.log('Invoking scoreZones function...')
  const res = await fetch(`${url}/functions/v1/scoreZones`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  })
  const scoringResult = await res.json()
  console.log('Scoring function result:', scoringResult)

  // 4. Verify alert exists in the alerts table
  const { data: alerts, error: aErr } = await supabase
    .from('alerts')
    .select('*, zones(name)')
    .eq('zone_id', zone.id)
    .order('created_at', { ascending: false })
    .limit(1)

  let alertVerified = false
  if (aErr || !alerts?.length) {
    console.error('No alert found in database:', aErr)
  } else {
    const a = alerts[0]
    console.log(`✅ Alert successfully generated and recorded in database!`)
    console.log(`   Alert ID:   ${a.id}`)
    console.log(`   Zone:       ${a.zones?.name}`)
    console.log(`   Risk Level: ${a.risk_level}`)
    console.log(`   Risk Score: ${a.risk_score}/100`)
    console.log(`   Distinct:   ${a.distinct_reporters}`)
    console.log(`   Dominant:   ${a.dominant_category}`)
    alertVerified = true

    // Clean up test alert
    await supabase.from('alerts').delete().eq('id', a.id)
  }

  // 5. Clean up test flags
  for (const id of flagIds) {
    await supabase.from('flags').delete().eq('id', id)
  }
  console.log('🧹 Cleaned up test flags and alert records.')

  console.log('\n==============================')
  console.log(`End-to-End Scored Alert Test: ${alertVerified ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log('==============================\n')
}

testThresholdScoring().catch(console.error)
