import { createClient } from '@supabase/supabase-js'

const url = 'https://newirytyjkwuxrwggncz.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'
const anonClient = createClient(url, anonKey)

async function runTests() {
  console.log('====================================================')
  console.log('  TESTING QUESTION 2: Anon DELETE Permissions')
  console.log('====================================================')

  const { data: zones } = await anonClient.from('zones').select('id').limit(1)
  const zoneId = zones[0].id

  // 1. Insert a test flag, post, and comment
  const testHash = `del-test-${Date.now()}`
  const { data: flag, error: fErr } = await anonClient.from('flags').insert({
    zone_id: zoneId,
    category: 'suspicious',
    reporter_hash: testHash,
    description: 'Delete permission test flag',
  }).select().single()
  console.log('Inserted test flag:', flag?.id)

  const { data: post, error: pErr } = await anonClient.from('posts').insert({
    zone_id: zoneId,
    reporter_hash: testHash,
    body: 'Delete permission test post',
  }).select().single()
  console.log('Inserted test post:', post?.id)

  const { data: comment, error: cErr } = await anonClient.from('comments').insert({
    post_id: post.id,
    reporter_hash: testHash,
    body: 'Delete permission test comment',
  }).select().single()
  console.log('Inserted test comment:', comment?.id)

  // 2. Attempt DELETE on flags via anon
  console.log('\n--> Testing anon DELETE on flags...')
  const { error: delFlagErr } = await anonClient.from('flags').delete().eq('id', flag.id)
  if (delFlagErr) {
    console.log('✅ Anon DELETE on flags correctly REJECTED:', delFlagErr.message, `(code: ${delFlagErr.code})`)
  } else {
    console.error('❌ Anon DELETE on flags was not rejected!')
  }

  // 3. Attempt DELETE on posts via anon
  console.log('\n--> Testing anon DELETE on posts...')
  const { error: delPostErr } = await anonClient.from('posts').delete().eq('id', post.id)
  if (delPostErr) {
    console.log('✅ Anon DELETE on posts correctly REJECTED:', delPostErr.message, `(code: ${delPostErr.code})`)
  } else {
    console.error('❌ Anon DELETE on posts was not rejected!')
  }

  // 4. Attempt DELETE on comments via anon
  console.log('\n--> Testing anon DELETE on comments...')
  const { error: delCommentErr } = await anonClient.from('comments').delete().eq('id', comment.id)
  if (delCommentErr) {
    console.log('✅ Anon DELETE on comments correctly REJECTED:', delCommentErr.message, `(code: ${delCommentErr.code})`)
  } else {
    console.error('❌ Anon DELETE on comments was not rejected!')
  }

  console.log('\n====================================================')
  console.log('  TESTING QUESTION 3: Cooldown Rate Limiting (24h)')
  console.log('====================================================')

  const userA = `user-cooldown-A-${Date.now()}`
  const userB = `user-cooldown-B-${Date.now()}`

  // 1. First submission by User A
  console.log(`\nSubmitting Flag 1 from User A (${userA}) to zone ${zoneId}...`)
  const { data: flag1, error: err1 } = await anonClient.from('flags').insert({
    zone_id: zoneId,
    category: 'harassment',
    reporter_hash: userA,
    description: 'First report from User A',
  }).select().single()

  if (err1) {
    console.error('❌ Flag 1 from User A unexpectedly failed:', err1.message)
  } else {
    console.log('✅ Flag 1 from User A SUCCEEDED. ID:', flag1.id)
  }

  // 2. Second submission by User A to same zone within 24h
  console.log(`\nSubmitting Flag 2 from SAME User A (${userA}) to SAME zone ${zoneId}...`)
  const { data: flag2, error: err2 } = await anonClient.from('flags').insert({
    zone_id: zoneId,
    category: 'harassment',
    reporter_hash: userA,
    description: 'Second report from User A (should be blocked)',
  }).select().single()

  if (err2) {
    console.log('✅ Flag 2 from User A correctly REJECTED by rate limit trigger!')
    console.log('   Error Message:', err2.message)
  } else {
    console.error('❌ Flag 2 was NOT rejected! ID:', flag2.id)
  }

  // 3. Submission by User B to same zone
  console.log(`\nSubmitting Flag 3 from DIFFERENT User B (${userB}) to SAME zone ${zoneId}...`)
  const { data: flag3, error: err3 } = await anonClient.from('flags').insert({
    zone_id: zoneId,
    category: 'harassment',
    reporter_hash: userB,
    description: 'First report from User B',
  }).select().single()

  if (err3) {
    console.error('❌ Flag 3 from User B unexpectedly failed:', err3.message)
  } else {
    console.log('✅ Flag 3 from User B SUCCEEDED. ID:', flag3.id)
  }
}

runTests().catch(console.error)
