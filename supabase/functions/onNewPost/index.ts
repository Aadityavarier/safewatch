// Supabase Edge Function: onNewPost
// Triggered on new post insert to detect sensitive PII or inappropriate naming patterns.
// Sets `flagged_for_review = true` without rejecting the submission.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Regex patterns to check for phone numbers, email addresses, or specific names
const SUSPICIOUS_PATTERNS = [
  /\b\d{10}\b/,                         // 10-digit Indian mobile numbers
  /\b\+?91[-\s]?\d{10}\b/,              // +91 mobile numbers
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
  /\b(?:flat|room|house|plot)\s*(?:no\.?|number)?\s*\d+/i, // Specific residences
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const record = payload.record ?? payload // handles webhook or direct body

    if (!record || !record.id || !record.body) {
      return new Response(JSON.stringify({ message: 'No post record found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const text = record.body as string
    const containsPII = SUSPICIOUS_PATTERNS.some((regex) => regex.test(text))

    if (containsPII) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      const supabase = createClient(supabaseUrl, supabaseKey)

      await supabase
        .from('posts')
        .update({ flagged_for_review: true })
        .eq('id', record.id)

      return new Response(
        JSON.stringify({ flagged: true, postId: record.id, reason: 'Matched PII pattern' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ flagged: false, postId: record.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
