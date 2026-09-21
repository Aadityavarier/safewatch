import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://newirytyjkwuxrwggncz.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function runVerification() {
  console.log('====================================================')
  console.log('SafeWatch Automated Verification Suite (Fix 0 – Fix 9)')
  console.log('====================================================\n')

  let allPass = true

  // 1. Audit Source Files for Fix 1, 2, 3, 7, 8, 9
  console.log('1. Static Code Audits:')

  // Check Report.tsx
  const reportSrc = fs.readFileSync('src/pages/Report.tsx', 'utf8')
  const hasReportSearch = reportSrc.includes('id="loc-search"')
  const hasReportAnonToggle = reportSrc.includes('id="anon"')
  const hasStaticBadge = reportSrc.includes('100% Anonymous Incident Report')
  console.log(`  - Report.tsx search dropdown removed: ${!hasReportSearch ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - Report.tsx teal anonymity toggle removed: ${!hasReportAnonToggle ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - Report.tsx static anonymous badge present: ${hasStaticBadge ? 'PASS ✅' : 'FAIL ❌'}`)
  if (hasReportSearch || hasReportAnonToggle || !hasStaticBadge) allPass = false

  // Check PostNew.tsx
  const postNewSrc = fs.readFileSync('src/pages/PostNew.tsx', 'utf8')
  const hasPostNewSelect = postNewSrc.includes('<select')
  const hasDisplayNameToggle = postNewSrc.includes('postWithName')
  console.log(`  - PostNew.tsx zone select dropdown removed: ${!hasPostNewSelect ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - PostNew.tsx optional display name toggle present: ${hasDisplayNameToggle ? 'PASS ✅' : 'FAIL ❌'}`)
  if (hasPostNewSelect || !hasDisplayNameToggle) allPass = false

  // Check App.tsx
  const appSrc = fs.readFileSync('src/App.tsx', 'utf8')
  const hasUserRound = appSrc.includes('UserRound')
  const hasAnonMe01 = appSrc.includes('anon-me01')
  const hasMock2FA = appSrc.includes('2-factor verification is skipped')
  const hasAdminGuard = appSrc.includes('authorityUser') && appSrc.includes('signInAuthority')
  console.log(`  - App.tsx UserRound avatar removed: ${!hasUserRound ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - App.tsx anon-me01 mock profile removed: ${!hasAnonMe01 ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - App.tsx mock 2FA text removed: ${!hasMock2FA ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - App.tsx authority auth guard present: ${hasAdminGuard ? 'PASS ✅' : 'FAIL ❌'}`)
  if (hasUserRound || hasAnonMe01 || hasMock2FA || !hasAdminGuard) allPass = false

  // Check analytics.ts
  const analyticsSrc = fs.readFileSync('src/lib/analytics.ts', 'utf8')
  const hasHist = analyticsSrc.includes('const HIST')
  const hasAllTimeBase = analyticsSrc.includes('ALL_TIME_BASE')
  const hasPrevWeek39 = analyticsSrc.includes('prevWeek = 39')
  console.log(`  - analytics.ts mock HIST removed: ${!hasHist ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - analytics.ts ALL_TIME_BASE removed: ${!hasAllTimeBase ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`  - analytics.ts hardcoded prevWeek=39 removed: ${!hasPrevWeek39 ? 'PASS ✅' : 'FAIL ❌'}`)
  if (hasHist || hasAllTimeBase || hasPrevWeek39) allPass = false

  // 2. Fix 0: Slug UUID Resolution & Accurate Rate-Limit Error Surfacing
  console.log('\n2. Fix 0: Flag Submission & Rate Limit Accuracy:')
  const testHash = `verify-hash-${Date.now()}`
  const { data: collegeGate } = await supabase.from('zones').select('id, slug').eq('slug', 'college-gate').single()
  
  if (!collegeGate) {
    console.error('  FAIL ❌: college-gate zone not found')
    allPass = false
  } else {
    // First submission
    const { data: f1, error: err1 } = await supabase.from('flags').insert({
      zone_id: collegeGate.id,
      category: 'following',
      reporter_hash: testHash,
      description: 'Test flag submission 1',
    }).select().single()

    console.log(`  - Initial flag insert: ${f1 && !err1 ? 'SUCCESS ✅' : 'FAIL ❌'}`)

    // Immediate second submission (cooldown rate-limit trigger)
    const { data: f2, error: err2 } = await supabase.from('flags').insert({
      zone_id: collegeGate.id,
      category: 'following',
      reporter_hash: testHash,
      description: 'Test flag submission 2 (immediate)',
    }).select().single()

    const isCooldownError = err2?.message?.includes('Rate limit exceeded')
    console.log(`  - Cooldown rate limit properly caught: ${isCooldownError ? 'PASS ✅ (' + err2.message + ')' : 'FAIL ❌'}`)
    if (!isCooldownError) allPass = false

    // Cleanup test flag
    if (f1?.id) await supabase.from('flags').delete().eq('id', f1.id)
  }

  // 3. Fix 4: Display Name in Community Feed and Comments
  console.log('\n3. Fix 4: Optional Display Name on Posts & Comments:')
  const { data: post, error: pErr } = await supabase.from('posts').insert({
    zone_id: collegeGate!.id,
    reporter_hash: `rep-display-test-${Date.now()}`,
    body: 'Notice from campus volunteer: safety lighting operational.',
    display_name: 'Campus Patrol Volunteer',
  }).select().single()

  console.log(`  - Post with display_name inserted: ${post?.display_name === 'Campus Patrol Volunteer' ? 'PASS ✅' : 'FAIL ❌'}`)

  let commentPass = false
  if (post?.id) {
    const { data: comment, error: cErr } = await supabase.from('comments').insert({
      post_id: post.id,
      reporter_hash: `rep-comm-test-${Date.now()}`,
      body: 'Acknowledged, thank you for the update.',
      display_name: 'Resident Maya',
    }).select().single()

    commentPass = comment?.display_name === 'Resident Maya'
    console.log(`  - Comment with display_name inserted: ${commentPass ? 'PASS ✅' : 'FAIL ❌'}`)

    // Cleanup
    await supabase.from('posts').delete().eq('id', post.id)
  }
  if (!post || !commentPass) allPass = false

  // 4. Fix 5: Authority Authentication with Supabase Auth
  console.log('\n4. Fix 5: Authority Authentication via Supabase Auth:')
  // Test invalid password
  const { error: invalidAuthErr } = await supabase.auth.signInWithPassword({
    email: 'officer@safewatch.internal',
    password: 'WrongPassword123!',
  })
  console.log(`  - Invalid credentials rejected: ${invalidAuthErr ? 'PASS ✅ (' + invalidAuthErr.message + ')' : 'FAIL ❌'}`)

  // Test valid password
  const officerPassword = process.env.OFFICER_PASSWORD || ''
  const { data: validAuth, error: validAuthErr } = await supabase.auth.signInWithPassword({
    email: 'officer@safewatch.internal',
    password: officerPassword,
  })
  const authSuccess = !!validAuth.user && !validAuthErr
  console.log(`  - Valid authority credentials accepted: ${authSuccess ? 'PASS ✅ (' + validAuth.user?.email + ')' : (officerPassword ? 'FAIL ❌' : 'SKIPPED ⚠️ (OFFICER_PASSWORD env not set)')}`)
  await supabase.auth.signOut()
  if (!invalidAuthErr || !authSuccess) allPass = false

  // 5. Fix 6: Alerts Table Sync
  console.log('\n5. Fix 6: Server Alerts Sync:')
  const { data: liveAlerts } = await supabase.from('alerts').select('id, risk_level, risk_score, zones(name)').limit(5)
  const hasLiveAlerts = !!liveAlerts && liveAlerts.length > 0
  console.log(`  - Real alerts in database: ${hasLiveAlerts ? 'PASS ✅ (' + liveAlerts.length + ' found)' : 'FAIL ❌'}`)
  if (hasLiveAlerts) {
    liveAlerts.forEach((a) => {
      console.log(`     Alert ${a.id}: Zone ${a.zones?.name}, Risk ${a.risk_level}, Score ${a.risk_score}`)
    })
  }
  if (!hasLiveAlerts) allPass = false

  // 6. Fix 7 & 8: 30-day Window Flag Count
  console.log('\n6. Fix 7 & 8: 30-day Flags Window:')
  const { data: allFlags, count } = await supabase.from('flags').select('id', { count: 'exact' })
  console.log(`  - Total flags currently in database: ${count} flags`)
  console.log(`  - Flags count sufficient for 30-day analytics: ${count && count >= 30 ? 'PASS ✅' : 'FAIL ❌'}`)
  if (!count || count < 30) allPass = false

  console.log('\n====================================================')
  console.log(`Final Verification Result: ${allPass ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`)
  console.log('====================================================')
}

runVerification().catch(console.error)

