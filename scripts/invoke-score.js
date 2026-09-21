const url = 'https://newirytyjkwuxrwggncz.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'

async function run() {
  const res = await fetch(`${url}/functions/v1/scoreZones`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  })
  const data = await res.json()
  console.log('ScoreZones Response:', JSON.stringify(data, null, 2))
}

run().catch(console.error)
