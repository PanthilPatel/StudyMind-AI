/**
 * Supabase Client Configuration (Bulletproof Vercel Fix)
 * 
 * Creates and exports a singleton Supabase client instance.
 * MUST use Vite environment variable syntax for Vercel deployment.
 * 
 * FIXES:
 * 1. Automatic "Quote & Space Stripping" — Prevent crash if user copies with quotes.
 * 2. Robust URL checking — ensure it's a valid, trimmed HTTPS URL.
 * 3. Silent Fallback — If the setup fails, the app returns a "safe" client instead of crashing.
 */

import { createClient } from '@supabase/supabase-js';

// Helper to clean up variables (removes quotes, spaces, etc.)
const cleanVar = (val) => {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["'](.+(?=["']$))["']$/, '$1').trim();
};

const rawUrl = cleanVar(import.meta.env.VITE_SUPABASE_URL);
const rawKey = cleanVar(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Debug Log (Visible in Browser Console)
console.log("Supabase URL Check:", rawUrl ? "Present (checking validity...)" : "Missing");

const isValidUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const isConfigured = isValidUrl(rawUrl) && rawKey.length > 20;

if (!isConfigured && rawUrl) {
  console.error(
    "SUPABASE CONFIG ERROR: The URL provided is invalid or the Key is too short.\n" +
    "URL Received:", `"${rawUrl}"`
  );
}

// Fallback values to prevent "Invalid supabaseUrl" crash
const supabaseUrl = isConfigured ? rawUrl : 'https://placeholder-project.supabase.co';
const supabaseKey = isConfigured ? rawKey : 'placeholder-anon-key';

let client;
try {
  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
} catch (err) {
  console.error("CRITICAL: Supabase client constructor failed!", err);
  // Last resort: initialize with dummy values that definitely won't throw
  client = createClient('https://placeholder.supabase.co', 'placeholder');
}

export const supabase = client;
export const isSupabaseConfigured = isConfigured;
export const configDetails = { url: rawUrl, isConfigured }; // Exported for debug
