const url = 'https://newirytyjkwuxrwggncz.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'

async function testScoreZones() {
  console.log('\n--- 1. Testing scoreZones Edge Function ---')
  const endpoint = `${url}/functions/v1/scoreZones`
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    })
    console.log('HTTP Status:', res.status)
    const text = await res.text()
    console.log('Response Body:', text)
    if (res.ok) {
      console.log('✅ scoreZones responded successfully!')
      return true
    } else {
      console.error('❌ scoreZones returned non-200 response')
      return false
    }
  } catch (err) {
    console.error('❌ scoreZones invocation error:', err.message)
    return false
  }
}

async function testOnNewPost() {
  console.log('\n--- 2. Testing onNewPost Edge Function ---')
  const endpoint = `${url}/functions/v1/onNewPost`
  
  // Test A: Normal post without PII
  console.log('Test 2A: Normal post (expect flagged: false)...')
  try {
    const resA = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        record: {
          id: '00000000-0000-0000-0000-000000000000',
          body: 'Streetlights near Sector 3 are flickering, walk with caution.',
        },
      }),
    })
    console.log('HTTP Status 2A:', resA.status)
    const dataA = await resA.json()
    console.log('Response 2A:', dataA)
    const passA = dataA.flagged === false
    if (passA) {
      console.log('✅ Normal post passed inspection (not flagged).')
    } else {
      console.error('❌ Expected flagged: false but got:', dataA)
    }

    // Test B: Post containing phone number PII
    console.log('\nTest 2B: Post with PII phone number (expect flagged: true)...')
    const resB = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        record: {
          id: '00000000-0000-0000-0000-000000000000',
          body: 'Call John Doe at +91-9876543210 about the incident.',
        },
      }),
    })
    console.log('HTTP Status 2B:', resB.status)
    const dataB = await resB.json()
    console.log('Response 2B:', dataB)
    const passB = dataB.flagged === true
    if (passB) {
      console.log('✅ Sensitive post correctly detected and flagged for review!')
    } else {
      console.error('❌ Expected flagged: true but got:', dataB)
    }

    return passA && passB
  } catch (err) {
    console.error('❌ onNewPost invocation error:', err.message)
    return false
  }
}

async function main() {
  const scoreOk = await testScoreZones()
  const postOk = await testOnNewPost()

  console.log('\n==============================')
  console.log(`scoreZones: ${scoreOk ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`onNewPost:  ${postOk ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log('==============================\n')
}

main().catch(console.error)
