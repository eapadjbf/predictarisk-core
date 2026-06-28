import { createClient } from "@supabase/supabase-js";

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

if (!envUrl || !envKey) {
  throw new Error(
    "Missing Supabase configuration. Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.",
  );
}

// The project URL and the publishable/anon key are easy to paste into the wrong
// variable. Detect each value by its shape so the client still connects even if
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are swapped.
const looksLikeUrl = (v: string) =>
  /^https?:\/\//i.test(v) || /\.supabase\.(co|in)\b/i.test(v);

let rawUrl = envUrl;
let anonKey = envKey;
if (!looksLikeUrl(envUrl) && looksLikeUrl(envKey)) {
  rawUrl = envKey;
  anonKey = envUrl;
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
