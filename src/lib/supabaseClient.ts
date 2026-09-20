import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// If credentials are missing the app renders a ConnectionErrorBanner instead of
// silently substituting fake data. There is intentionally no mock/demo fallback.
export const SUPABASE_MISSING = !url || !key

export const supabase = SUPABASE_MISSING
  ? null
  : createClient(url!, key!)

export type SupabaseClient = NonNullable<typeof supabase>
