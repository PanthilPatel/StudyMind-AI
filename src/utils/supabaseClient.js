/**
 * Supabase Client Configuration
 * 
 * Creates and exports a singleton Supabase client instance.
 * Uses environment variables for secure credential management.
 * Gracefully handles missing credentials (app still renders, auth features disabled).
 * 
 * Setup:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Copy your project URL and anon key
 * 3. Add them to your .env file as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' &&
  supabaseAnonKey !== 'your_supabase_anon_key';

if (!isConfigured) {
  console.warn(
    '⚠️ Supabase credentials not found. Auth and database features will be unavailable.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
  );
}

// Create client with real or placeholder URL (placeholder won't connect but won't crash)
export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isConfigured ? supabaseAnonKey : 'placeholder-key'
);

export const isSupabaseConfigured = isConfigured;
