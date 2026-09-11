import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database' // <-- Import tipe yang sudah kita generate

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// Buat client Supabase yang sudah "Typed" 100%
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)