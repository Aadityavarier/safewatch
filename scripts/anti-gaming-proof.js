import { createClient } from '@supabase/supabase-js'

const url = 'https://newirytyjkwuxrwggncz.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'
const supabase = createClient(url, anonKey)

async function main() {
  console.log('Fetching Station Road zone...')
  const { data: zone } = await supabase.from('zones').select('*').eq('slug', 'station-road').single()
  console.log(`Station Road ID: ${zone.id}\n`)

  console.log('===============================================================')
  console.log(' RUN 1: Sybil / Flood Attack (10 flags from 1 single reporter)')
  console.log('===============================================================')

  // Note: Cooldown trigger is bypassed for Run 1 flags via direct SQL
  console.log('Inserting 10 flags with single reporter_hash = "attacker-single-device" ...')

  return { zoneId: zone.id }
}

main().catch(console.error)
