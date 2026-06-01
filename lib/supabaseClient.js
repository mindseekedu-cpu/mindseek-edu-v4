import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing environment variable: SUPABASE_URL. Pastikan sudah diisi di file .env.local')
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: SUPABASE_ANON_KEY. Pastikan sudah diisi di file .env.local')
}

let supabaseInstance = null

/**
 * Mengembalikan Supabase client singleton.
 * Hanya membuat instance baru jika belum ada.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  }
  return supabaseInstance
}

const supabase = getSupabaseClient()

export default supabase
export { getSupabaseClient }
