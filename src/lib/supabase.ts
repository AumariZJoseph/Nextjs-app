// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a Supabase client with cookie persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: (key) => {
        if (typeof window === 'undefined') return null
        const item = window.localStorage.getItem(key)
        console.log(`Getting ${key} from storage:`, item)
        return item
      },
      setItem: (key, value) => {
        if (typeof window === 'undefined') return
        console.log(`Setting ${key} in storage:`, value)
        window.localStorage.setItem(key, value)
      },
      removeItem: (key) => {
        if (typeof window === 'undefined') return
        console.log(`Removing ${key} from storage`)
        window.localStorage.removeItem(key)
      },
    },
  },
})