import { createClient } from '@supabase/supabase-js'

const url = 'https://newirytyjkwuxrwggncz.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld2lyeXR5amt3dXhyd2dnbmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODkyNzUsImV4cCI6MjEwNTQ2NTI3NX0.CUgRWOn-XwY6LEjJT_YfgJ5U9sbhDCxCBskYVZeMYMs'
const publishableKey = 'sb_publishable_tHeubxN73FJCcJOpi08hCg_pXPn1ypm'

async function testWithKey(name, key) {
  console.log(`\n--- Testing with ${name} ---`)
  const supabase = createClient(url, key)
  
  // 1. Test SELECT from zones
  const { data: zones, error: zoneErr } = await supabase.from('zones').select('*').limit(5)
  if (zoneErr) {
    console.error(`❌ [${name}] SELECT zones failed:`, zoneErr.message)
    return false
  }
  console.log(`✅ [${name}] SELECT zones succeeded. Found ${zones.length} zones. (e.g. ${zones[0]?.name})`)

  // 2. Test INSERT into flags
  const testZoneId = zones[0]?.id
  const { data: insertedFlag, error: flagErr } = await supabase.from('flags').insert({
    zone_id: testZoneId,
    category: 'suspicious',
    reporter_hash: 'test-verifier-hash',
    description: 'Connection verification ping',
    repeat: false,
  }).select().single()

  if (flagErr) {
    console.error(`❌ [${name}] INSERT flag failed:`, flagErr.message)
    return false
  }
  console.log(`✅ [${name}] INSERT flag succeeded. Flag ID: ${insertedFlag.id}`)

  // 3. Test SELECT back from flags
  const { data: readFlag, error: readFlagErr } = await supabase.from('flags').select('*').eq('id', insertedFlag.id).single()
  if (readFlagErr) {
    console.error(`❌ [${name}] SELECT flag failed:`, readFlagErr.message)
    return false
  }
  console.log(`✅ [${name}] SELECT flag confirmed: ${readFlag.description}`)

  // 4. Test INSERT into posts
  const { data: insertedPost, error: postErr } = await supabase.from('posts').insert({
    zone_id: testZoneId,
    reporter_hash: 'test-verifier-hash',
    body: 'Verification test post',
  }).select().single()

  if (postErr) {
    console.error(`❌ [${name}] INSERT post failed:`, postErr.message)
    return false
  }
  console.log(`✅ [${name}] INSERT post succeeded. Post ID: ${insertedPost.id}`)

  // 5. Test increment_upvotes RPC
  const { error: rpcErr } = await supabase.rpc('increment_upvotes', { post_id: insertedPost.id })
  if (rpcErr) {
    console.error(`❌ [${name}] RPC increment_upvotes failed:`, rpcErr.message)
    return false
  }
  console.log(`✅ [${name}] RPC increment_upvotes succeeded.`)

  // 6. Test INSERT into comments
  const { data: insertedComment, error: commentErr } = await supabase.from('comments').insert({
    post_id: insertedPost.id,
    reporter_hash: 'test-verifier-hash',
    body: 'Verification test reply',
  }).select().single()

  if (commentErr) {
    console.error(`❌ [${name}] INSERT comment failed:`, commentErr.message)
    return false
  }
  console.log(`✅ [${name}] INSERT comment succeeded. Comment ID: ${insertedComment.id}`)

  // Clean up test post & comment
  await supabase.from('comments').delete().eq('id', insertedComment.id)
  await supabase.from('posts').delete().eq('id', insertedPost.id)
  await supabase.from('flags').delete().eq('id', insertedFlag.id)
  console.log(`🧹 [${name}] Cleaned up test records.`)

  return true
}

async function main() {
  const anonOk = await testWithKey('Legacy Anon JWT', anonKey)
  const pubOk = await testWithKey('New Publishable Key', publishableKey)

  console.log('\n==============================')
  console.log(`Summary:`)
  console.log(`Legacy Anon JWT: ${anonOk ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`Publishable Key: ${pubOk ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log('==============================\n')
}

main().catch(console.error)
