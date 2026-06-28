import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

if (!rawUrl || !anonKey) {
  throw new Error(
    "Missing Supabase configuration. Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.",
  );
}

// Normalise the project URL: tolerate a missing protocol or a trailing slash so
// values pasted as "xxxx.supabase.co" or "https://xxxx.supabase.co/" still work.
const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
